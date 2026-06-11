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
    <div v-if="ytVideoId || biliBvid || playbackMessage" class="mv-player-tips">
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
import { useI18n } from '@/i18n'
import type { MessageKey } from '@/i18n/messages'

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
const playbackMessage = ref('')
const fallbackBiliIframeUrl = ref('')
const videoRef = ref<HTMLVideoElement | null>(null)

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
    playbackMessage.value = ''
    fallbackBiliIframeUrl.value = ''
    if (props.trackId && props.biliBvid) {
      try {
        const playback = await api.mvPlayback(props.trackId)
        fallbackBiliIframeUrl.value = playback.fallbackIframeUrl
        if (playback.videoUrl) {
          proxyVideoUrl.value = playback.videoUrl
          playbackMessage.value = playback.quality ? t('mv.proxyReadyQuality', { quality: playback.quality }) : t('mv.proxyReady')
          await nextTick()
          if (!isMobile.value) void videoRef.value?.play().catch(() => undefined)
        } else if (playback.message && playback.message !== 'ok') {
          playbackMessage.value = t('mv.proxyFallbackMessage', { message: localizePlaybackReason(playback.message) })
        }
      } catch {
        playbackMessage.value = t('mv.proxyFallback')
      }
    }
    setTimeout(() => {
      videoLoaded.value = true
    }, 3000)
  },
)

watch(showModal, (val) => {
  emit('update:show', val)
})

function stopVideo() {
  videoRef.value?.pause()
  proxyVideoUrl.value = ''
  fallbackBiliIframeUrl.value = ''
  playbackMessage.value = ''
  videoLoaded.value = false
}

function localizePlaybackReason(value: string) {
  const key = playbackReasonKeys[value]
  return key ? t(key) : value
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
