import { createFile, MP4BoxBuffer, type ISOFile, type Movie } from 'mp4box'

/**
 * Play a Bilibili DASH stream (separate video/audio fMP4 files) through
 * MediaSource. Each stream is parsed by its own mp4box instance and the media
 * segments are appended to the matching SourceBuffer — the same approach the
 * official Bilibili web player uses.
 *
 * Performance properties (DESIGN_SPECS §6.4 方案5 / UX-10):
 *
 * - Range-based, on-demand segment fetching with a buffered-ahead budget. The
 *   stream is NEVER downloaded in full: fetching pauses once enough media is
 *   buffered and resumes as the buffer drains, so watching the first seconds
 *   no longer downloads the whole file.
 * - An AbortSignal is threaded through every fetch. Closing the player,
 *   switching quality or leaving the route cancels in-flight downloads
 *   immediately instead of letting them run to completion.
 * - Both SourceBuffers are created before any data is appended, because Chrome
 *   locks the MediaSource buffer count once a track has data. Audio init is
 *   small and fetched in parallel, so the video first frame is not meaningfully
 *   delayed by the audio track.
 *
 * Returns a cleanup function; throws if MediaSource is unavailable or a stream
 * cannot be loaded so callers can fall back to MP4 playback.
 */

const RANGE_CHUNK_BYTES = 2 * 1024 * 1024
const BUFFER_AHEAD_SECONDS = 60
const BUFFER_POLL_INTERVAL_MS = 400

export interface DashStreamOptions {
  /** Abort in-flight fetches when this signal fires. */
  signal?: AbortSignal | null
  /** Called when a mid-stream fetch/parse error occurs (after playback started). */
  onError?: (error: unknown) => void
}

export async function playDashStream(
  videoElement: HTMLVideoElement,
  videoUrl: string,
  audioUrl: string | null | undefined,
  options: DashStreamOptions = {},
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
  const signal = options.signal ?? null
  const abortError = new DOMException('DASH stream aborted', 'AbortError')
  const isAborted = () => Boolean(signal?.aborted)

  // Track readiness: both mp4box files must reach onReady (init parsed and
  // SourceBuffer added) before we append data — Chrome locks the buffer count
  // once a track has data, so both SourceBuffers must exist first.
  let resolveVideoReady: (payload: { file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }) => void = () => undefined
  let resolveAudioReady: (payload: { file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }) => void = () => undefined
  const videoReady = new Promise<{ file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }>((resolve) => { resolveVideoReady = resolve })
  const audioReady = audioUrl
    ? new Promise<{ file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }>((resolve) => { resolveAudioReady = resolve })
    : Promise.resolve<{ file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] } | null>(null)

  let videoFile: ISOFile<unknown, unknown> | null = null
  let audioFile: ISOFile<unknown, unknown> | null = null
  const bufferedAhead = () => bufferedAheadSeconds(videoElement)

  try {
    const tasks: Array<Promise<void>> = [
      startPipe(videoUrl, mediaSource, videoQueue, 1, cleanupHandlers, bufferedAhead, signal, isAborted, abortError, (payload) => {
        videoFile = payload.file
        resolveVideoReady(payload)
      }),
    ]
    if (audioUrl) {
      tasks.push(startPipe(audioUrl, mediaSource, audioQueue, 2, cleanupHandlers, bufferedAhead, signal, isAborted, abortError, (payload) => {
        audioFile = payload.file
        resolveAudioReady(payload)
      }))
    }

    // Wait for both SourceBuffers to exist before appending any data (Chrome
    // rejects a second addSourceBuffer once a track has data). Both inits are
    // in the first small chunk of each stream and are fetched in parallel.
    // Race the readiness against pipe completion/failure and abort so the init
    // phase can never hang the caller (missing onReady → never-settling ready
    // promises; streams finishing without an init → treated as an error).
    const tasksPromise = Promise.all(tasks)
    const readyOrFinished = Promise.race([
      Promise.all([videoReady, audioReady]),
      tasksPromise.then(() => {
        throw new Error('Stream ended before media init was parsed')
      }),
    ])
    const abortPromise = signal
      ? new Promise<never>((_resolve, reject) => {
          if (signal.aborted) {
            reject(abortError)
            return
          }
          // { once: true } removes the listener when it fires; if the stream
          // completes naturally the race has already settled, so a late reject
          // is a no-op and the listener dies with the signal's owner.
          signal.addEventListener('abort', () => reject(abortError), { once: true })
        })
      : new Promise<never>(() => undefined)

    let video: { file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }
    let audio: { file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] } | null
    ;[video, audio] = await Promise.race([readyOrFinished, abortPromise])
    // Video data first: it owns the first frame.
    for (const init of video.inits) videoQueue.push(init)
    if (audio) for (const init of audio.inits) audioQueue.push(init)
    if (video) video.file.start()
    if (audio) audio.file.start()
    // Drain samples that were parsed before start() was reached (the pump
    // keeps the raw data in memory instead of flushing it away).
    if (video) video.file.processSamples(true)
    if (audio) audio.file.processSamples(true)
    void videoElement.play().catch(() => undefined)

    // Segment fetching continues in the background. The cleanup function is
    // returned right away so the caller can tear the stream down mid-flight
    // (closing the player, switching quality, leaving the route) instead of
    // waiting for the full download to finish.
    void tasksPromise.then(
      () => {
        if (mediaSource.readyState === 'open') {
          try {
            mediaSource.endOfStream()
          } catch {
            // ignore
          }
        }
      },
      (error) => {
        if (!isAborted()) {
          console.warn('DASH stream ended with error', error)
          options.onError?.(error)
        }
      },
    )
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
  bufferedAhead: () => number,
  signal: AbortSignal | null,
  isAborted: () => boolean,
  abortError: DOMException,
  onTrackReady: (payload: { file: ISOFile<unknown, unknown>; inits: ArrayBuffer[] }) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const file = createFile()
    ;(file as { discardMdatData?: boolean }).discardMdatData = false
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
        const inits = initializations.filter((init) => init.user === user).map((init) => init.buffer)
        onTrackReady({ file, inits })
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

    void fetchStream(url, file, bufferedAhead, signal, isAborted).then(
      () => {
        if (isAborted()) {
          resolve()
          return
        }
        if (error) reject(error)
        else resolve()
      },
      (err) => {
        // A deliberate abort is not a failure — the caller already tore down.
        if (isAborted()) resolve()
        else reject(err)
      },
    )
  })
}

/**
 * Fetch the stream in sequential 2MB ranges, pausing when the video element
 * has enough buffered ahead and resuming as it drains. The full file is only
 * downloaded if the user actually keeps watching.
 */
async function fetchStream(
  url: string,
  file: ReturnType<typeof createFile>,
  bufferedAhead: () => number,
  signal: AbortSignal | null,
  isAborted: () => boolean,
) {
  let fileStart = 0
  let totalSize: number | null = null

  while (!isAborted()) {
    // Backpressure: hold off pulling more data while comfortably buffered.
    if (bufferedAhead() >= BUFFER_AHEAD_SECONDS) {
      await sleep(BUFFER_POLL_INTERVAL_MS)
      continue
    }

    const chunkEnd = fileStart + RANGE_CHUNK_BYTES - 1
    const response = await fetch(url, {
      signal: signal ?? undefined,
      headers: { Range: `bytes=${fileStart}-${chunkEnd}` },
    })
    if (!response.ok) {
      // 416 Range Not Satisfiable simply means we already have everything.
      if (response.status === 416) break
      throw new Error(`Stream request failed with ${response.status}`)
    }

    totalSize = totalSize ?? parseTotalSize(response)
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength === 0) break

    const pending = new Uint8Array(buffer)
    file.appendBuffer(MP4BoxBuffer.fromArrayBuffer(pending.buffer, fileStart))
    fileStart += buffer.byteLength
    if (totalSize != null && fileStart >= totalSize) break
  }

  // Do NOT flush() here: flush() clears the buffered sample data, which would
  // make getSample() fail if start()/processSamples runs later. processSamples
  // is safe to call repeatedly and keeps the data available.
  file.processSamples(true)
}

function bufferedAheadSeconds(videoElement: HTMLVideoElement) {
  try {
    const buffered = videoElement.buffered
    if (!buffered.length) return 0
    const end = buffered.end(buffered.length - 1)
    const current = Number.isFinite(videoElement.currentTime) ? videoElement.currentTime : 0
    return Math.max(0, end - current)
  } catch {
    return 0
  }
}

function parseTotalSize(response: Response) {
  const range = response.headers.get('content-range')
  if (!range) return null
  const match = /\/\s*(\d+)\s*$/.exec(range)
  return match ? Number(match[1]) : null
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
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
  let quotaRetries = 0
  const MAX_QUOTA_RETRIES = 10

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
    } catch (error) {
      updating = false
      // Only QuotaExceededError is retryable — anything else would loop
      // forever on a genuinely bad segment, so drop it and carry on.
      const quotaExceeded = error instanceof DOMException && error.name === 'QuotaExceededError'
      if (quotaExceeded && quotaRetries < MAX_QUOTA_RETRIES) {
        quotaRetries += 1
        queue.unshift(buffer)
        setTimeout(flush, 250)
        return
      }
      if (!quotaExceeded) console.warn('SourceBuffer append failed; dropping segment', error)
      return
    }
    sourceBuffer.addEventListener(
      'updateend',
      () => {
        updating = false
        quotaRetries = 0
        flush()
      },
      { once: true },
    )
  }
}
