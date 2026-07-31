import { createFile, MP4BoxBuffer, type ISOFile, type Movie } from 'mp4box'

/**
 * Play a Bilibili DASH stream (separate video/audio fMP4 files) through
 * MediaSource. Each stream is parsed by its own mp4box instance and the media
 * segments are appended to the matching SourceBuffer — the same approach the
 * official Bilibili web player uses.
 *
 * Returns a cleanup function; throws if MediaSource is unavailable or a stream
 * cannot be loaded so callers can fall back to MP4 playback.
 */
export async function playDashStream(
  videoElement: HTMLVideoElement,
  videoUrl: string,
  audioUrl: string | null | undefined,
): Promise<() => void> {
  if (!('MediaSource' in window)) throw new Error('MediaSource is not supported')

  const mediaSource = new MediaSource()
  const objectUrl = URL.createObjectURL(mediaSource)
  videoElement.src = objectUrl

  await new Promise<void>((resolve, reject) => {
    mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
    mediaSource.addEventListener('sourceerror', () => reject(new Error('MediaSource failed to open')), { once: true })
  })

  const videoQueue = createBufferQueue()
  const audioQueue = createBufferQueue()
  const cleanupHandlers: Array<() => void> = []
  let playbackStarted = false

  const onVideoReady = () => {
    if (!playbackStarted) {
      playbackStarted = true
      void videoElement.play().catch(() => undefined)
    }
  }

  try {
    await Promise.all([
      startPipe(videoUrl, mediaSource, videoQueue, 1, cleanupHandlers, onVideoReady),
      audioUrl ? startPipe(audioUrl, mediaSource, audioQueue, 2, cleanupHandlers, undefined) : Promise.resolve(),
    ])
  } catch (error) {
    runCleanup(cleanupHandlers, mediaSource, objectUrl, videoQueue, audioQueue)
    throw error
  }

  return () => runCleanup(cleanupHandlers, mediaSource, objectUrl, videoQueue, audioQueue)
}

function startPipe(
  url: string,
  mediaSource: MediaSource,
  queue: ReturnType<typeof createBufferQueue>,
  user: number,
  cleanupHandlers: Array<() => void>,
  onPlaybackReady?: () => void,
) {
  return new Promise<void>((resolve, reject) => {
    const file = createFile()
    let error: Error | null = null

    file.onReady = (info: Movie) => {
      const track = info.videoTracks[0] ?? info.audioTracks[0]
      if (!track) {
        error = new Error('No track found in stream')
        return
      }
      const kind = info.videoTracks[0] ? 'video' : 'audio'
      try {
        const sourceBuffer = mediaSource.addSourceBuffer(`${kind}/mp4; codecs="${track.codec}"`)
        queue.attach(sourceBuffer)
        file.setSegmentOptions(track.id, user, { nbSamples: 1000 })
        const initializations = file.initializeSegmentation('per-track')
        for (const init of initializations) {
          if (init.user === user) queue.push(init.buffer)
        }
        file.start()
        onPlaybackReady?.()
      } catch (err) {
        error = err instanceof Error ? err : new Error(String(err))
      }
    }

    file.onSegment = (_id, segmentUser, buffer) => {
      if (segmentUser === user) queue.push(buffer)
    }

    file.onError = (_module, message) => {
      error = new Error(message)
    }

    cleanupHandlers.push(() => {
      try {
        file.stop()
      } catch {
        // ignore
      }
    })

    void pump(url, file).then(
      () => {
        if (error) reject(error)
        else resolve()
      },
      (err) => reject(err),
    )
  })
}

async function pump(url: string, file: ReturnType<typeof createFile>) {
  const response = await fetch(url)
  if (!response.ok || !response.body) throw new Error(`Stream request failed with ${response.status}`)

  const reader = response.body.getReader()
  const chunkSize = 512 * 1024
  let pending = new Uint8Array(0)
  let fileStart = 0

  const appendPending = () => {
    if (pending.length === 0) return
    const buffer = MP4BoxBuffer.fromArrayBuffer(pending.buffer, fileStart)
    file.appendBuffer(buffer)
    fileStart += pending.length
    pending = new Uint8Array(0)
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) {
      const merged = new Uint8Array(pending.length + value.length)
      merged.set(pending)
      merged.set(value, pending.length)
      pending = merged
      if (pending.length >= chunkSize) appendPending()
    }
  }

  appendPending()
  file.flush()
}

function runCleanup(
  handlers: Array<() => void>,
  mediaSource: MediaSource,
  objectUrl: string,
  videoQueue: ReturnType<typeof createBufferQueue>,
  audioQueue: ReturnType<typeof createBufferQueue>,
) {
  for (const handler of handlers) {
    try {
      handler()
    } catch {
      // ignore
    }
  }
  videoQueue.detach()
  audioQueue.detach()
  if (mediaSource.readyState === 'open') {
    try {
      mediaSource.endOfStream()
    } catch {
      // ignore
    }
  }
  URL.revokeObjectURL(objectUrl)
}

function createBufferQueue() {
  let sourceBuffer: SourceBuffer | null = null
  let queue: ArrayBuffer[] = []
  let updating = false

  return {
    attach(sb: SourceBuffer) {
      sourceBuffer = sb
    },
    detach() {
      sourceBuffer = null
      queue = []
    },
    push(buffer: ArrayBuffer) {
      if (!sourceBuffer) return
      queue.push(buffer)
      flush()
    },
  }

  function flush() {
    if (!sourceBuffer || updating || queue.length === 0) return
    const buffer = queue.shift()
    if (!buffer) return
    updating = true
    try {
      sourceBuffer.appendBuffer(buffer)
    } catch {
      updating = false
      flush()
      return
    }
    sourceBuffer.addEventListener(
      'updateend',
      () => {
        updating = false
        flush()
      },
      { once: true },
    )
  }
}
