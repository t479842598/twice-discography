<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="title"
    class="mv-player-modal"
    :bordered="false"
    @after-leave="stopVideo"
  >
    <div class="mv-player-container" :style="posterStyle">
      <video
        v-if="proxyVideoUrl"
        ref="videoRef"
        class="mv-player-video"
        :src="videoSrc"
        :poster="poster || undefined"
        controls
        playsinline
        :autoplay="!isMobile"
        @waiting="videoBuffering = true"
        @stalled="videoBuffering = true"
        @canplay="videoBuffering = false"
        @playing="onVideoPlaying"
        @pause="videoPaused = true"
        @error="onVideoError"
      />
      <iframe
        v-else-if="iframeUrl"
        :src="iframeUrl"
        class="mv-player-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
      />
      <n-empty v-else :description="t('mv.noLink')">
        <template #extra>
          <n-button size="small" @click="showModal = false">{{ t('mv.close') }}</n-button>
        </template>
      </n-empty>
      <div v-if="showVideoOverlay" class="mv-player-loading" role="status">
        <n-spin size="small" />
        <span>{{ videoBuffering ? t('mv.buffering') : t('mv.resolving') }}</span>
      </div>
    </div>
    <div v-if="qualityOptions.length > 1 || playbackMessage" class="mv-player-tips">
      <div v-if="qualityOptions.length > 1" class="mv-quality-row" role="group" :aria-label="t('mv.qualityLabel')">
        <span class="mv-quality-label">{{ t('mv.qualityLabel') }}</span>
        <button
          v-for="option in qualityOptions"
          :key="option.qn"
          type="button"
          class="mv-quality-chip"
          :class="{ 'is-active': selectedQn === option.qn }"
          :aria-pressed="selectedQn === option.qn"
          @click="switchQuality(option.qn)"
        >
          {{ option.label }}
        </button>
        <span v-if="isSwitchingQuality" class="mv-quality-busy">{{ t('mv.switching') }}</span>
      </div>
      <p v-if="playbackMessage">
        <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></n-icon>
        {{ playbackMessage }}
      </p>
      <div v-if="biliBvid" class="mv-mode-row" role="group" :aria-label="t('mv.playerMode')">
        <span class="mv-quality-label">{{ t('mv.playerMode') }}</span>
        <button
          v-for="mode in playerModes"
          :key="mode"
          type="button"
          class="mv-quality-chip"
          :class="{ 'is-active': playerMode === mode }"
          :aria-pressed="playerMode === mode"
          @click="setPlayerMode(mode)"
        >
          {{ playerModeLabel(mode) }}
        </button>
      </div>
      <div v-if="isMobile" class="mv-player-actions">
        <n-button v-if="ytVideoId" text tag="a" :href="`https://www.youtube.com/watch?v=${ytVideoId}`" target="_blank" rel="noopener noreferrer">
          {{ t('mv.openYoutube') }}
        </n-button>
        <n-button v-if="biliBvid" text tag="a" :href="`https://www.bilibili.com/video/${biliBvid}`" target="_blank" rel="noopener noreferrer">
          {{ t('mv.openBilibili') }}
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { api } from '@/api/client'
import type { MvPlaybackResponse } from '@/api/types'
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'
import { playDashStream } from './dashPlayer'

const { t } = useI18n()
const playbackReasonKeys: Record<string, MessageKey> = {
  'B站凭证未配置': 'mv.proxy.reason.notConfigured',
  bili_credential_not_configured: 'mv.proxy.reason.notConfigured',
  mv_proxy_not_configured: 'mv.proxy.reason.proxyNotConfigured',
  bili_playurl_empty: 'mv.proxy.reason.playurlEmpty',
  bili_view_failed: 'mv.proxy.reason.viewFailed',
  bili_playurl_failed: 'mv.proxy.reason.playurlFailed',
}

const props = defineProps<{
  show: boolean
  title: string
  trackId?: string | null
  ytVideoId?: string | null
  biliBvid?: string | null
  biliPage?: number | null
  poster?: string | null
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const showModal = ref(props.show)
const isMobile = ref(false)
const videoLoading = ref(false)
const videoBuffering = ref(false)
const videoPlaying = ref(false)
const videoPaused = ref(false)
const proxyVideoUrl = ref('')
const proxyAudioUrl = ref('')
const playbackFormat = ref<'mp4' | 'dash'>('mp4')
const qualityOptions = ref<Array<{ qn: number; label: string }>>([])
const selectedQn = ref<number | null>(null)
const isSwitchingQuality = ref(false)
const playbackMessage = ref('')
const fallbackBiliIframeUrl = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
let dashCleanup: (() => void) | null = null
let playbackAbort: AbortController | null = null
let playbackFetchAbort: AbortController | null = null
let autoUpgradeDone = false
let autoUpgradeTimer: number | null = null

// ---- Playback channel preference (DESIGN_SPECS §6.4 方案10) ----
const MV_PLAYER_MODE_KEY = 'twice.mvPlayerMode.v1'
const MV_QUALITY_PREF_KEY = 'twice.mvQuality.v1'
const KNOWN_QUALITIES = new Set([127, 126, 125, 120, 116, 112, 100, 80, 74, 64, 48, 32, 16, 6])
const playerModes = ['auto', 'iframe'] as const
const playerMode = ref<'auto' | 'iframe'>(readPlayerMode())

function readPlayerMode(): 'auto' | 'iframe' {
  try {
    // 'proxy' was folded into 'auto' (they behaved identically); map it back.
    if (localStorage.getItem(MV_PLAYER_MODE_KEY) === 'iframe') return 'iframe'
  } catch {
    // ignore
  }
  return 'auto'
}

function readQualityPref() {
  try {
    const qn = Number(localStorage.getItem(MV_QUALITY_PREF_KEY))
    return KNOWN_QUALITIES.has(qn) ? qn : null
  } catch {
    return null
  }
}

function saveQualityPref(qn: number) {
  try {
    localStorage.setItem(MV_QUALITY_PREF_KEY, String(qn))
  } catch {
    // ignore
  }
}

function playerModeLabel(mode: 'auto' | 'iframe') {
  return mode === 'iframe' ? t('mv.modeIframe') : t('mv.modeAuto')
}

const posterStyle = computed(() => (props.poster ? { backgroundImage: `url(${props.poster})` } : {}))

const showVideoOverlay = computed(() => {
  if (videoPlaying.value) return false
  if (proxyVideoUrl.value && !videoBuffering.value) return false
  return videoLoading.value || videoBuffering.value
})

if (typeof window !== 'undefined') {
  isMobile.value = window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

const localBiliIframeUrl = computed(() => {
  if (!props.biliBvid) return ''
  const search = new URLSearchParams({
    bvid: props.biliBvid,
    page: String(props.biliPage || 1),
    autoplay: isMobile.value ? '0' : '1',
    high_quality: '1',
    danmaku: '0',
    as_wide: '1',
  })
  return `https://player.bilibili.com/player.html?${search.toString()}`
})

const videoSrc = computed(() => (playbackFormat.value === 'dash' ? undefined : proxyVideoUrl.value))

const iframeUrl = computed(() => {
  if (proxyVideoUrl.value) return ''
  if (fallbackBiliIframeUrl.value || localBiliIframeUrl.value) return fallbackBiliIframeUrl.value || localBiliIframeUrl.value
  return props.ytVideoId ? `https://www.youtube.com/embed/${props.ytVideoId}?autoplay=${isMobile.value ? 0 : 1}&rel=0` : ''
})

watch(
  () => props.show,
  (val) => {
    showModal.value = val
    if (!val) return
    videoLoading.value = true
    videoBuffering.value = false
    videoPlaying.value = false
    videoPaused.value = false
    autoUpgradeDone = false
    clearAutoUpgradeTimer()
    proxyVideoUrl.value = ''
    proxyAudioUrl.value = ''
    playbackFormat.value = 'mp4'
    qualityOptions.value = []
    selectedQn.value = null
    isSwitchingQuality.value = false
    playbackMessage.value = ''
    fallbackBiliIframeUrl.value = ''
    void openPlayback()
  },
)

async function applyPlayback(playback: MvPlaybackResponse) {
  // The user switched to the official player while this response was in flight.
  if (playerMode.value === 'iframe') return
  fallbackBiliIframeUrl.value = playback.fallbackIframeUrl
  selectedQn.value = playback.quality
  qualityOptions.value = playback.qualities?.length ? playback.qualities : []

  if (playback.videoUrl) {
    playbackMessage.value = playback.quality ? t('mv.proxyReadyQuality', { quality: biliQualityLabel(playback.quality) }) : t('mv.proxyReady')
    await nextTick()

    if (playback.format === 'dash' && playback.audioUrl) {
      playbackFormat.value = 'dash'
      proxyVideoUrl.value = playback.videoUrl
      proxyAudioUrl.value = playback.audioUrl
      await nextTick()
      if (videoRef.value) {
        playbackFetchAbort?.abort()
        const controller = new AbortController()
        playbackFetchAbort = controller
        try {
          dashCleanup = await playDashStream(videoRef.value, playback.videoUrl, playback.audioUrl, {
            signal: controller.signal,
            onError: () => {
              if (showModal.value && !controller.signal.aborted) void fallbackToMp4()
            },
          })
          videoLoading.value = false
        } catch {
          // Fall back to the highest MP4 quality (720P) when DASH/MSE fails.
          videoLoading.value = false
          if (!controller.signal.aborted) await fallbackToMp4()
        }
      }
    } else {
      playbackFormat.value = 'mp4'
      proxyVideoUrl.value = playback.videoUrl
      proxyAudioUrl.value = ''
      await nextTick()
      videoLoading.value = false
      if (!isMobile.value) void videoRef.value?.play().catch(() => undefined)
    }
  } else if (playback.message && playback.message !== 'ok') {
    playbackMessage.value = t('mv.proxyFallbackMessage', { message: localizePlaybackReason(playback.message) })
    videoLoading.value = false
  }
}

async function fallbackToMp4() {
  if (!props.trackId || playerMode.value === 'iframe') return
  try {
    teardownDash()
    const mp4 = await api.mvPlayback(props.trackId, 64, 'mp4')
    if (showModal.value && mp4.videoUrl && mp4.format !== 'dash') {
      playbackFormat.value = 'mp4'
      proxyVideoUrl.value = mp4.videoUrl
      proxyAudioUrl.value = ''
      qualityOptions.value = mp4.qualities?.length ? mp4.qualities : qualityOptions.value
      selectedQn.value = mp4.quality
      playbackMessage.value = mp4.quality ? t('mv.proxyReadyQuality', { quality: biliQualityLabel(mp4.quality) }) : t('mv.proxyReady')
      await nextTick()
      videoLoading.value = false
      if (!isMobile.value) void videoRef.value?.play().catch(() => undefined)
    }
  } catch {
    if (showModal.value) playbackMessage.value = t('mv.proxyFallback')
    videoLoading.value = false
  }
}

let qualitySwitchSeq = 0

async function switchQuality(qn: number, preserveTime = false) {
  if (!props.trackId) return
  const seq = ++qualitySwitchSeq
  const resumeAt = preserveTime ? (videoRef.value?.currentTime || 0) : 0
  isSwitchingQuality.value = true
  playbackAbort?.abort()
  const controller = new AbortController()
  playbackAbort = controller
  try {
    saveQualityPref(qn)
    autoUpgradeDone = true
    const playback = await api.mvPlayback(props.trackId, qn, undefined, controller.signal)
    if (seq !== qualitySwitchSeq || !showModal.value || controller.signal.aborted || playerMode.value === 'iframe') return
    if (playback.videoUrl) {
      teardownDash()
      await applyPlayback(playback)
      if (resumeAt > 0) restorePlaybackTime(resumeAt, !videoPaused.value)
    }
  } catch {
    if (seq === qualitySwitchSeq && showModal.value && !controller.signal.aborted) playbackMessage.value = t('mv.proxyFallback')
  } finally {
    if (seq === qualitySwitchSeq) isSwitchingQuality.value = false
  }
}

function teardownDash() {
  playbackFetchAbort?.abort()
  playbackFetchAbort = null
  dashCleanup?.()
  dashCleanup = null
}

watch(showModal, (val) => {
  emit('update:show', val)
})

function stopVideo() {
  clearAutoUpgradeTimer()
  teardownDash()
  playbackAbort?.abort()
  playbackAbort = null
  videoRef.value?.pause()
  proxyVideoUrl.value = ''
  proxyAudioUrl.value = ''
  fallbackBiliIframeUrl.value = ''
  playbackMessage.value = ''
  qualityOptions.value = []
  selectedQn.value = null
  videoLoading.value = false
  videoBuffering.value = false
  videoPlaying.value = false
  videoPaused.value = false
}

async function openPlayback() {
  if (playerMode.value === 'iframe' || !props.trackId || !props.biliBvid) {
    videoLoading.value = false
    return
  }
  videoLoading.value = true
  playbackAbort?.abort()
  const controller = new AbortController()
  playbackAbort = controller
  // Start at a low quality for a fast first frame, then upgrade once the
  // stream is stable to the user's remembered quality (DESIGN_SPECS §6.4 方案4).
  const targetQn = readQualityPref() ?? 80
  const startQn = Math.min(targetQn, 32)
  try {
    const playback = await api.mvPlayback(props.trackId, startQn, undefined, controller.signal)
    if (!showModal.value || controller.signal.aborted) return
    await applyPlayback(playback)
    maybeAutoUpgrade(targetQn)
  } catch {
    if (!showModal.value || controller.signal.aborted) return
    playbackMessage.value = t('mv.proxyFallback')
  } finally {
    if (showModal.value && !controller.signal.aborted) videoLoading.value = false
  }
}

function maybeAutoUpgrade(targetQn: number) {
  if (autoUpgradeDone || !props.trackId) return
  const current = selectedQn.value
  if (current == null || current >= targetQn) return
  if (!qualityOptions.value.some((option) => option.qn >= targetQn)) return
  // Don't disrupt a video that is already watched deep (the new quality stream
  // re-downloads sequentially from byte 0 up to the seek position).
  if ((videoRef.value?.currentTime || 0) > 180) return

  clearAutoUpgradeTimer()
  let fired = false
  const attempt = () => {
    if (fired || !showModal.value) return
    if (videoBuffering.value || !videoPlaying.value || videoPaused.value) return
    if (bufferedSeconds() < 8) return
    fired = true
    clearAutoUpgradeTimer()
    void switchQuality(targetQn, true)
  }
  autoUpgradeTimer = window.setInterval(attempt, 1000)
  window.setTimeout(() => {
    if (!fired) {
      fired = true
      clearAutoUpgradeTimer()
    }
  }, 30_000)
}

function clearAutoUpgradeTimer() {
  if (autoUpgradeTimer != null) {
    window.clearInterval(autoUpgradeTimer)
    autoUpgradeTimer = null
  }
}

function bufferedSeconds() {
  const video = videoRef.value
  if (!video) return 0
  try {
    const buffered = video.buffered
    if (!buffered.length) return 0
    const end = buffered.end(buffered.length - 1)
    const current = Number.isFinite(video.currentTime) ? video.currentTime : 0
    return Math.max(0, end - current)
  } catch {
    return 0
  }
}

function restorePlaybackTime(seconds: number, shouldPlay = true) {
  const video = videoRef.value
  if (!video) return
  const seek = () => {
    // A stale seek from a previous stream must not fire after the modal
    // closed (the loadedmetadata listener can outlive the current playback).
    if (!showModal.value) return
    try {
      if (video.readyState >= 1) {
        video.currentTime = seconds
        if (shouldPlay) void video.play().catch(() => undefined)
      }
    } catch {
      // ignore
    }
  }
  if (video.readyState >= 1) seek()
  else video.addEventListener('loadedmetadata', seek, { once: true })
}

function onVideoPlaying() {
  videoPlaying.value = true
  videoBuffering.value = false
  videoPaused.value = false
}

function onVideoError() {
  videoBuffering.value = false
  videoPlaying.value = false
  videoPaused.value = false
}

async function setPlayerMode(mode: 'auto' | 'iframe') {
  playerMode.value = mode
  try {
    localStorage.setItem(MV_PLAYER_MODE_KEY, mode)
  } catch {
    // ignore
  }
  if (mode === 'iframe') {
    playbackAbort?.abort()
    playbackAbort = null
    teardownDash()
    videoRef.value?.pause()
    proxyVideoUrl.value = ''
    proxyAudioUrl.value = ''
    playbackFormat.value = 'mp4'
    qualityOptions.value = []
    selectedQn.value = null
    isSwitchingQuality.value = false
    playbackMessage.value = ''
    videoBuffering.value = false
    videoLoading.value = false
  } else {
    void openPlayback()
  }
}

function localizePlaybackReason(value: string) {
  const key = playbackReasonKeys[value]
  return key ? t(key) : value
}

const BILI_QUALITY: Record<number, string> = {
  120: '4K',
  116: '1080P 60帧',
  112: '1080P 高码率',
  80: '1080P',
  74: '720P 60帧',
  64: '720P',
  48: '720P',
  32: '480P',
  16: '360P',
  6: '240P',
}
function biliQualityLabel(qn: number | null) {
  if (qn == null) return t('mv.qualityUnknown')
  return BILI_QUALITY[qn] || `${qn}P`
}
</script>

<style>
.mv-player-modal {
  width: min(1200px, calc(100vw - 32px));
}

.mv-player-container {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%;
  background: #000 center / cover no-repeat;
  border-radius: 12px;
  overflow: hidden;
}

.mv-player-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--muted-text);
  font-size: 14px;
  font-weight: 600;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(2px);
  pointer-events: none;
}

.mv-mode-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mv-player-iframe,
.mv-player-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  background: #000;
}

.mv-player-tips {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
  background: var(--panel-bg);
  border: 1px solid var(--soft-border);
}

.mv-player-tips p {
  margin: 0 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--muted-text);
}

.mv-player-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.mv-quality-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mv-quality-label {
  color: var(--muted-text);
  font-size: 13px;
  font-weight: 800;
}

.mv-quality-chip {
  padding: 5px 12px;
  border: 1px solid rgba(255, 107, 157, 0.25);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--page-text);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mv-quality-chip:hover {
  border-color: rgba(255, 107, 157, 0.55);
  color: var(--accent-strong);
}

.mv-quality-chip.is-active {
  background: linear-gradient(135deg, var(--accent-strong), var(--accent));
  border-color: transparent;
  color: #fff;
  box-shadow: 0 6px 16px -8px rgba(233, 30, 99, 0.7);
}

.mv-quality-busy {
  color: var(--muted-text);
  font-size: 12px;
}

@media (max-width: 640px) {
  .mv-player-modal {
    width: calc(100vw - 16px);
  }

  .mv-player-modal .n-card {
    margin: 8px;
  }

  .mv-player-container,
  .mv-player-iframe,
  .mv-player-video {
    border-radius: 8px;
  }
}
</style>
