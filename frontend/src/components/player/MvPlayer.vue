<template>
  <n-modal
    v-model:show="showModal"
    preset="card"
    :title="title"
    class="mv-player-modal"
    :bordered="false"
    @after-leave="stopVideo"
  >
    <div class="mv-player-container">
      <video
        v-if="proxyVideoUrl"
        ref="videoRef"
        class="mv-player-video"
        :src="proxyVideoUrl"
        controls
        playsinline
        :autoplay="!isMobile"
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
      <p v-else-if="isMobile && !videoLoaded">
        <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></n-icon>
        {{ t('mv.loadTip') }}
      </p>
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
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
}>()

const showModal = ref(props.show)
const isMobile = ref(false)
const videoLoaded = ref(false)
const proxyVideoUrl = ref('')
const proxyAudioUrl = ref('')
const playbackFormat = ref<'mp4' | 'dash'>('mp4')
const playbackQuality = ref<number | null>(null)
const qualityOptions = ref<Array<{ qn: number; label: string }>>([])
const selectedQn = ref<number | null>(null)
const isSwitchingQuality = ref(false)
const playbackMessage = ref('')
const fallbackBiliIframeUrl = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)
let dashCleanup: (() => void) | null = null

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

const iframeUrl = computed(() => {
  if (proxyVideoUrl.value) return ''
  if (fallbackBiliIframeUrl.value || localBiliIframeUrl.value) return fallbackBiliIframeUrl.value || localBiliIframeUrl.value
  return props.ytVideoId ? `https://www.youtube.com/embed/${props.ytVideoId}?autoplay=${isMobile.value ? 0 : 1}&rel=0` : ''
})

watch(
  () => props.show,
  async (val) => {
    showModal.value = val
    if (!val) return
    videoLoaded.value = false
    proxyVideoUrl.value = ''
    proxyAudioUrl.value = ''
    playbackFormat.value = 'mp4'
    playbackQuality.value = null
    qualityOptions.value = []
    selectedQn.value = null
    isSwitchingQuality.value = false
    playbackMessage.value = ''
    fallbackBiliIframeUrl.value = ''
    if (props.trackId && props.biliBvid) {
      try {
        const playback = await api.mvPlayback(props.trackId)
        await applyPlayback(playback)
      } catch {
        playbackMessage.value = t('mv.proxyFallback')
      }
    }
    setTimeout(() => {
      videoLoaded.value = true
    }, 3000)
  },
)

async function applyPlayback(playback: MvPlaybackResponse) {
  fallbackBiliIframeUrl.value = playback.fallbackIframeUrl
  playbackQuality.value = playback.quality
  selectedQn.value = playback.quality
  qualityOptions.value = playback.qualities?.length ? playback.qualities : []

  if (playback.videoUrl) {
    playbackMessage.value = playback.quality ? t('mv.proxyReadyQuality', { quality: biliQualityLabel(playback.quality) }) : t('mv.proxyReady')
    await nextTick()

    if (playback.format === 'dash' && playback.audioUrl) {
      playbackFormat.value = 'dash'
      proxyVideoUrl.value = playback.videoUrl
      proxyAudioUrl.value = playback.audioUrl
      if (videoRef.value) {
        try {
          dashCleanup = await playDashStream(videoRef.value, playback.videoUrl, playback.audioUrl)
        } catch {
          // Fall back to the highest MP4 quality (720P) when DASH/MSE fails.
          await fallbackToMp4()
        }
      }
    } else {
      playbackFormat.value = 'mp4'
      proxyVideoUrl.value = playback.videoUrl
      proxyAudioUrl.value = ''
      if (!isMobile.value) void videoRef.value?.play().catch(() => undefined)
    }
  } else if (playback.message && playback.message !== 'ok') {
    playbackMessage.value = t('mv.proxyFallbackMessage', { message: localizePlaybackReason(playback.message) })
  }
}

async function fallbackToMp4() {
  if (!props.trackId) return
  try {
    const mp4 = await api.mvPlayback(props.trackId, 64)
    if (mp4.videoUrl && mp4.format !== 'dash') {
      playbackFormat.value = 'mp4'
      proxyVideoUrl.value = mp4.videoUrl
      proxyAudioUrl.value = ''
      qualityOptions.value = mp4.qualities?.length ? mp4.qualities : qualityOptions.value
      playbackQuality.value = mp4.quality
      selectedQn.value = mp4.quality
      playbackMessage.value = mp4.quality ? t('mv.proxyReadyQuality', { quality: biliQualityLabel(mp4.quality) }) : t('mv.proxyReady')
      await nextTick()
      if (!isMobile.value) void videoRef.value?.play().catch(() => undefined)
    }
  } catch {
    playbackMessage.value = t('mv.proxyFallback')
  }
}

async function switchQuality(qn: number) {
  if (!props.trackId || isSwitchingQuality.value) return
  isSwitchingQuality.value = true
  try {
    const playback = await api.mvPlayback(props.trackId, qn)
    if (playback.videoUrl) {
      teardownDash()
      await applyPlayback(playback)
    }
  } catch {
    playbackMessage.value = t('mv.proxyFallback')
  } finally {
    isSwitchingQuality.value = false
  }
}

function teardownDash() {
  dashCleanup?.()
  dashCleanup = null
}

watch(showModal, (val) => {
  emit('update:show', val)
})

function stopVideo() {
  teardownDash()
  videoRef.value?.pause()
  proxyVideoUrl.value = ''
  proxyAudioUrl.value = ''
  fallbackBiliIframeUrl.value = ''
  playbackMessage.value = ''
  playbackQuality.value = null
  qualityOptions.value = []
  selectedQn.value = null
  videoLoaded.value = false
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
  background: #000;
  border-radius: 12px;
  overflow: hidden;
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
