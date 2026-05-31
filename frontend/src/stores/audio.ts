import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { MusicCandidate, PlaybackResponse, Track } from '@/api/types'

export type PlayMode = 'sequence' | 'repeat' | 'shuffle'

const playbackCache = new Map<string, PlaybackResponse>()
const playbackRequests = new Map<string, Promise<PlaybackResponse>>()
const candidateCache = new Map<string, MusicCandidate[]>()
const audioWarmers = new Map<string, HTMLAudioElement>()
const isMobile = typeof window !== 'undefined' && (window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

function playbackKey(trackId: string, source?: string) {
  return `${trackId}:${source || 'best'}`
}

export const useAudioStore = defineStore('audio', () => {
  const currentTrack = ref<Track | null>(null)
  const selected = ref<MusicCandidate | null>(null)
  const candidates = ref<MusicCandidate[]>([])
  const audioUrl = ref('')
  const lrc = ref('')
  const queue = ref<Track[]>([])
  const queueIndex = ref(-1)
  const playMode = ref<PlayMode>('sequence')
  const loading = ref(false)
  const playing = ref(false)
  const error = ref('')
  const failedSources = ref<string[]>([])

  function resetFailuresIfTrackChanged(track: Track) {
    if (currentTrack.value?.id !== track.id) failedSources.value = []
  }

  function setQueue(tracks: Track[], startTrack: Track) {
    const queueTracks = tracks.filter((track) => track.id)
    const startIndex = queueTracks.findIndex((track) => track.id === startTrack.id)

    queue.value = queueTracks.length > 0 ? queueTracks : [startTrack]
    queueIndex.value = startIndex >= 0 ? startIndex : 0
  }

  function ensureStandaloneQueue(track: Track) {
    const isQueuedTrack = queue.value.some((queueTrack) => queueTrack.id === track.id)
    if (!isQueuedTrack) {
      queue.value = [track]
      queueIndex.value = 0
    }
  }

  function syncQueueIndex(track: Track) {
    const nextIndex = queue.value.findIndex((queueTrack) => queueTrack.id === track.id)
    if (nextIndex >= 0) queueIndex.value = nextIndex
  }

  function nextQueueIndex() {
    if (queue.value.length === 0) return -1
    if (playMode.value === 'shuffle' && queue.value.length > 1) {
      const availableIndexes = queue.value.map((_, index) => index).filter((index) => index !== queueIndex.value)
      return availableIndexes[Math.floor(Math.random() * availableIndexes.length)] ?? -1
    }

    const nextIndex = queueIndex.value + 1
    if (nextIndex < queue.value.length) return nextIndex
    return playMode.value === 'repeat' ? 0 : -1
  }

  function previousQueueIndex() {
    if (queue.value.length === 0) return -1
    if (playMode.value === 'shuffle' && queue.value.length > 1) {
      const availableIndexes = queue.value.map((_, index) => index).filter((index) => index !== queueIndex.value)
      return availableIndexes[Math.floor(Math.random() * availableIndexes.length)] ?? -1
    }

    const previousIndex = queueIndex.value - 1
    if (previousIndex >= 0) return previousIndex
    return playMode.value === 'repeat' ? queue.value.length - 1 : -1
  }

  function cyclePlayMode() {
    playMode.value = playMode.value === 'sequence' ? 'repeat' : playMode.value === 'repeat' ? 'shuffle' : 'sequence'
  }

  async function fetchPlayback(trackId: string, source?: string) {
    const key = playbackKey(trackId, source)
    const cached = playbackCache.get(key)
    if (cached) return cached

    const inflight = playbackRequests.get(key)
    if (inflight) return inflight

    const request = api.playback(trackId, source)
      .then((data) => {
        playbackCache.set(key, data)
        candidateCache.set(trackId, data.candidates)
        warmAudio(data.audioUrl)
        return data
      })
      .finally(() => {
        playbackRequests.delete(key)
      })

    playbackRequests.set(key, request)
    return request
  }

  function warmAudio(url: string) {
    // 移动端不预加载音频，节省流量和性能
    if (isMobile || !url || audioWarmers.has(url) || typeof Audio === 'undefined') return
    const warmer = new Audio()
    warmer.preload = 'metadata'
    warmer.src = url
    warmer.load()
    audioWarmers.set(url, warmer)
    if (audioWarmers.size > 16) {
      const oldestUrl = audioWarmers.keys().next().value
      if (oldestUrl) audioWarmers.delete(oldestUrl)
    }
  }

  async function prefetchTrack(track: Track, source?: string) {
    // 移动端不预加载
    if (isMobile) return
    try {
      await fetchPlayback(track.id, source)
    } catch {
      // Best-effort warmup only.
    }
  }

  async function loadTrack(track: Track) {
    ensureStandaloneQueue(track)
    syncQueueIndex(track)
    resetFailuresIfTrackChanged(track)
    loading.value = true
    error.value = ''
    currentTrack.value = track
    try {
      const data = await fetchPlayback(track.id)
      applyPlayback(data)
      playing.value = false
    } catch (err) {
      error.value = err instanceof Error ? err.message : '播放解析失败'
      const cachedCandidates = candidateCache.get(track.id)
      if (cachedCandidates) {
        candidates.value = cachedCandidates
        return
      }
      const list = await api.musicCandidates(track.id)
      candidates.value = list.candidates
      candidateCache.set(track.id, list.candidates)
    } finally {
      loading.value = false
    }
  }

  async function playTrack(track: Track, source?: string, options: { keepQueue?: boolean } = {}) {
    if (!options.keepQueue) ensureStandaloneQueue(track)
    syncQueueIndex(track)
    resetFailuresIfTrackChanged(track)
    if (currentTrack.value?.id === track.id && selected.value?.source === source && audioUrl.value) {
      playing.value = true
      return
    }

    loading.value = true
    error.value = ''
    currentTrack.value = track
    try {
      const data = await fetchPlayback(track.id, source)
      applyPlayback(data)
      playing.value = true
    } catch (err) {
      error.value = err instanceof Error ? err.message : '播放失败，正在尝试换源'
      if (source) markSourceFailed(source)
      await playNextCandidate(track)
    } finally {
      loading.value = false
    }
  }

  async function playTrackFromList(track: Track, tracks: Track[]) {
    setQueue(tracks, track)
    await playTrack(track, undefined, { keepQueue: true })
  }

  async function playNextCandidate(track = currentTrack.value) {
    if (!track) return
    const next = candidates.value.find((candidate) => candidate.playable && !failedSources.value.includes(candidate.source))
    if (next) {
      await playTrack(track, next.source, { keepQueue: true })
      return
    }
    playing.value = false
    error.value = '所有可用音源都播放失败了'
  }

  async function handleAudioError() {
    if (selected.value?.source) markSourceFailed(selected.value.source)
    await playNextCandidate()
  }

  async function handleAudioEnded() {
    const nextIndex = nextQueueIndex()
    const nextTrack = nextIndex >= 0 ? queue.value[nextIndex] : null
    if (!nextTrack) {
      playing.value = false
      return
    }

    queueIndex.value = nextIndex
    failedSources.value = []
    await playTrack(nextTrack, undefined, { keepQueue: true })
  }

  async function playNextInQueue() {
    const nextIndex = nextQueueIndex()
    const nextTrack = nextIndex >= 0 ? queue.value[nextIndex] : null
    if (!nextTrack) return

    queueIndex.value = nextIndex
    failedSources.value = []
    await playTrack(nextTrack, undefined, { keepQueue: true })
  }

  async function playPreviousInQueue() {
    const previousIndex = previousQueueIndex()
    const previousTrack = previousIndex >= 0 ? queue.value[previousIndex] : null
    if (!previousTrack) return

    queueIndex.value = previousIndex
    failedSources.value = []
    await playTrack(previousTrack, undefined, { keepQueue: true })
  }

  async function playQueueTrack(index: number) {
    const queueTrack = queue.value[index]
    if (!queueTrack) return

    queueIndex.value = index
    failedSources.value = []
    await playTrack(queueTrack, undefined, { keepQueue: true })
  }

  function markSourceFailed(source: string) {
    failedSources.value = Array.from(new Set([...failedSources.value, source]))
  }

  function applyPlayback(data: PlaybackResponse) {
    selected.value = data.selected
    candidates.value = data.candidates
    audioUrl.value = data.audioUrl
    lrc.value = data.lrc || ''
  }

  function setPlaying(value: boolean) {
    playing.value = value
  }

  function stop() {
    currentTrack.value = null
    selected.value = null
    audioUrl.value = ''
    lrc.value = ''
    queue.value = []
    queueIndex.value = -1
    playing.value = false
    error.value = ''
  }

  return {
    currentTrack,
    selected,
    candidates,
    audioUrl,
    lrc,
    queue,
    queueIndex,
    playMode,
    loading,
    playing,
    error,
    failedSources,
    loadTrack,
    playTrack,
    playTrackFromList,
    prefetchTrack,
    playNextCandidate,
    handleAudioError,
    handleAudioEnded,
    playNextInQueue,
    playPreviousInQueue,
    playQueueTrack,
    cyclePlayMode,
    setPlaying,
    stop,
  }
})
