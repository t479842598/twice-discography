import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api/client'
import type { MusicCandidate, PlaybackResponse, Track } from '@/api/types'

const playbackCache = new Map<string, PlaybackResponse>()
const playbackRequests = new Map<string, Promise<PlaybackResponse>>()
const candidateCache = new Map<string, MusicCandidate[]>()
const audioWarmers = new Map<string, HTMLAudioElement>()

function playbackKey(trackId: string, source?: string) {
  return `${trackId}:${source || 'best'}`
}

export const useAudioStore = defineStore('audio', () => {
  const currentTrack = ref<Track | null>(null)
  const selected = ref<MusicCandidate | null>(null)
  const candidates = ref<MusicCandidate[]>([])
  const audioUrl = ref('')
  const lrc = ref('')
  const loading = ref(false)
  const playing = ref(false)
  const error = ref('')
  const failedSources = ref<string[]>([])

  function resetFailuresIfTrackChanged(track: Track) {
    if (currentTrack.value?.id !== track.id) failedSources.value = []
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
    if (!url || audioWarmers.has(url) || typeof Audio === 'undefined') return
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
    try {
      await fetchPlayback(track.id, source)
    } catch {
      // Best-effort warmup only.
    }
  }

  async function loadTrack(track: Track) {
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

  async function playTrack(track: Track, source?: string) {
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

  async function playNextCandidate(track = currentTrack.value) {
    if (!track) return
    const next = candidates.value.find((candidate) => candidate.playable && !failedSources.value.includes(candidate.source))
    if (next) {
      await playTrack(track, next.source)
      return
    }
    playing.value = false
    error.value = '所有可用音源都播放失败了'
  }

  async function handleAudioError() {
    if (selected.value?.source) markSourceFailed(selected.value.source)
    await playNextCandidate()
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

  return {
    currentTrack,
    selected,
    candidates,
    audioUrl,
    lrc,
    loading,
    playing,
    error,
    failedSources,
    loadTrack,
    playTrack,
    prefetchTrack,
    playNextCandidate,
    handleAudioError,
    setPlaying,
  }
})
