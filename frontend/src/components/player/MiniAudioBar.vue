<template>
  <button
    v-if="audioStore.currentTrack && isMinimized"
    class="mini-audio-bubble"
    type="button"
    :title="t('player.expand')"
    :aria-label="t('player.expand')"
    @click="isMinimized = false"
  >
    <FallbackImage
      v-if="currentCoverSources.length"
      class="mini-audio-cover"
      :class="{ 'is-spinning': isCoverSpinning }"
      :sources="currentCoverSources"
      :alt="pickText(audioStore.currentTrack.title, localeStore.locale)"
      decoding="async"
    />
    <span v-else>{{ pickText(audioStore.currentTrack.title, localeStore.locale).slice(0, 1) }}</span>
  </button>

  <div v-if="audioStore.currentTrack" v-show="!isMinimized" class="mini-audio">
    <div class="mini-audio-info">
      <FallbackImage
        v-if="currentCoverSources.length"
        class="mini-audio-cover"
        :class="{ 'is-spinning': isCoverSpinning }"
        :sources="currentCoverSources"
        :alt="pickText(audioStore.currentTrack.title, localeStore.locale)"
        decoding="async"
      />
      <div>
        <strong>{{ pickText(audioStore.currentTrack.title, localeStore.locale) }}</strong>
        <span>{{ audioStore.selected?.sourceName || t('player.ready') }} · {{ audioStore.selected?.quality.label || t('player.resolving') }}</span>
      </div>
    </div>

    <div class="mini-audio-center">
      <div class="mini-audio-control-row">
        <n-button quaternary circle size="large" class="mini-mode-button" :title="playModeLabel" :aria-label="playModeLabel" @click="audioStore.cyclePlayMode()">
          <svg v-if="audioStore.playMode === 'shuffle'" class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M752.89 356.741h57.565v97.06L957.44 283.095l-146.939-167.04v110.817h-57.559c-164.813 0-272.317 127.002-354.427 239.053-73.697 100.72-137.492 195.748-240.292 195.748H66.56v129.92h91.617c164.813 0 257.813-135.014 339.968-247.07 73.698-100.773 151.7-187.782 254.746-187.782z m-446.632 74.291l21.335-28.907c17.515-23.803 35.835-49.045 55.777-74.092-59.044-57.267-130.12-99.533-225.193-99.533H66.56v129.874s24.699-1.239 91.617 0c64.784 1.434 105.416 28.954 148.08 72.658zM810.5 666.665h-57.559c-62.766 0-125.42-36.373-170.312-84.629a929.229 929.229 0 0 1-13.557 18.463c-19.702 26.87-40.832 55.824-64.144 84.337 60.585 61.368 148.383 111.703 248.013 111.703h57.56v111.406L957.44 736.947 810.501 570.214v96.451z" />
          </svg>
          <svg v-else-if="audioStore.playMode === 'repeat'" class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M537.073778 104.391111c128.028444-0.199111 249.059556 57.457778 328.220444 156.359111h-54.129778c-16.440889 0-31.630222 8.618667-39.879111 22.613334a44.572444 44.572444 0 0 0 0 45.255111c8.248889 13.994667 23.438222 22.641778 39.879111 22.641777h138.183112c25.429333 0 46.051556-20.280889 46.051555-45.255111V141.368889c0-24.974222-20.622222-45.226667-46.08-45.226667-25.429333 0-46.023111 20.252444-46.023111 45.226667v24.746667C807.296 68.608 675.114667 13.653333 537.073778 13.852444 256.241778 13.880889 28.288 236.544 28.288 511.658667c0 275.143111 227.953778 497.777778 508.785778 497.777777 197.660444 0 369.009778-110.307556 453.262222-271.416888a44.600889 44.600889 0 0 0-2.275556-45.226667 46.307556 46.307556 0 0 0-41.016888-20.650667 46.108444 46.108444 0 0 0-38.684445 24.576c-71.566222 136.618667-214.897778 222.435556-371.285333 222.208-230.343111 0-416.682667-182.528-416.682667-407.267555 0-224.711111 186.311111-407.267556 416.682667-407.267556z" />
            <path d="M541.141333 419.214222c-52.593778 0-95.232 41.386667-95.232 92.444445s42.638222 92.444444 95.232 92.444444c52.622222 0 95.260444-41.386667 95.260445-92.444444s-42.666667-92.444444-95.260445-92.444445z m-190.492444 92.444445c0-66.048 36.323556-127.089778 95.260444-160.113778a195.498667 195.498667 0 0 1 190.492445 0c58.936889 33.024 95.232 94.065778 95.232 160.142222 0 102.115556-85.276444 184.888889-190.492445 184.888889-105.187556 0-190.492444-82.773333-190.492444-184.888889z" />
          </svg>
          <svg v-else class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M721.493333 212.992l0.213334-63.786667a21.418667 21.418667 0 0 1 12.16-19.328 21.077333 21.077333 0 0 1 22.613333 2.901334l174.549333 127.829333a21.333333 21.333333 0 0 1-13.610666 37.717333H85.333333v-85.333333h636.16zM85.333333 810.453333l853.333334-0.213333v85.333333l-853.333334 0.256v-85.333333z m0-298.709333h853.077334v85.333333H85.333333v-85.333333z" />
          </svg>
        </n-button>
        <n-button quaternary circle size="large" :disabled="!canPlayPrevious" :title="t('player.previous')" :aria-label="t('player.previous')" @click="audioStore.playPreviousInQueue()">
          <svg class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M364.302083 465.602819L687.954365 218.588294c38.416414-29.327534 93.791393-1.929039 93.791392 46.396277v494.029051c0 48.325316-55.374979 75.725617-93.791392 46.398084L364.302083 558.397181c-30.600916-23.357989-30.600916-69.436372 0-92.794362zM238.945254 780.798397V451.684117v-164.562559c0-19.628152-5.904521-60.475733 17.057907-75.841215 25.523642-17.068744 59.747828 1.210165 59.747828 31.919454v493.676839c0 19.628152 5.915358 60.473927-17.047069 75.841215-25.53448 17.068744-59.758666-1.211971-59.758666-31.919454z" />
          </svg>
        </n-button>
        <n-button
          circle
          type="primary"
          size="large"
          class="mini-audio-play-button"
          :class="{ 'is-loading': audioStore.loading }"
          :title="playButtonLabel"
          :aria-label="playButtonLabel"
          :aria-busy="audioStore.loading"
          @click="togglePlayback"
        >
          <svg v-if="audioStore.loading" class="mini-audio-play-icon mini-audio-loading-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M12 3a9 9 0 1 1-8.18 5.25" />
          </svg>
          <svg v-else-if="audioStore.playing" class="mini-audio-play-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5v14" />
            <path d="M16 5v14" />
          </svg>
          <svg v-else class="mini-audio-play-icon mini-audio-icon-filled" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M8 5v14l11-7-11-7Z" />
          </svg>
        </n-button>
        <n-button quaternary circle size="large" :disabled="!canPlayNext" :title="t('player.next')" :aria-label="t('player.next')" @click="audioStore.playNextInQueue()">
          <svg class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M655.706179 465.602819L332.053897 218.588294c-38.414608-29.327534-93.791393-1.929039-93.791392 46.396277v494.029051c0 48.325316 55.376785 75.725617 93.791392 46.398084l323.652282-247.014525c30.602722-23.357989 30.602722-69.436372 0-92.794362zM781.064814 780.798397V451.684117v-164.562559c0-19.628152 5.904521-60.475733-17.057907-75.841215-25.523642-17.068744-59.747828 1.210165-59.747828 31.919454v493.676839c0 19.628152-5.915358 60.473927 17.047069 75.841215 25.532673 17.068744 59.758666-1.211971 59.758666-31.919454z" />
          </svg>
        </n-button>
        <n-badge v-if="isMobile" :value="displayQueue.length" :max="99" :show="displayQueue.length > 1">
          <n-button quaternary circle size="large" :title="t('player.queue')" :aria-label="t('player.queue')" @click="showQueueDrawer = true">
            <svg class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
              <path d="M512 874.666667a21.333333 21.333333 0 0 1-21.333333 21.333333H64a21.333333 21.333333 0 0 1 0-42.666667h426.666667a21.333333 21.333333 0 0 1 21.333333 21.333334zM64 128h896a21.333333 21.333333 0 0 0 0-42.666667H64a21.333333 21.333333 0 0 0 0 42.666667z m896 341.333333H64a21.333333 21.333333 0 0 0 0 42.666667h896a21.333333 21.333333 0 0 0 0-42.666667z m-100.573333 128A121.866667 121.866667 0 0 0 768 638.586667 121.866667 121.866667 0 0 0 676.573333 597.333333C609.333333 597.333333 554.666667 652 554.666667 719.24c0 29.046667 2.38 56.293333 31.64 95.653333 26.786667 36 75.426667 82.78 167.88 161.333334a21.333333 21.333333 0 0 0 27.626666 0c92.453333-78.58 141.093333-125.333333 167.88-161.333334 29.26-39.333333 31.64-66.606667 31.64-95.653333C981.333333 652 926.666667 597.333333 859.426667 597.333333z" />
            </svg>
          </n-button>
        </n-badge>
        <n-popover v-else trigger="click" placement="top" :width="380">
          <template #trigger>
            <n-badge :value="displayQueue.length" :max="99" :show="displayQueue.length > 1">
              <n-button quaternary circle size="large" :title="t('player.queue')" :aria-label="t('player.queue')">
                <svg class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
                  <path d="M512 874.666667a21.333333 21.333333 0 0 1-21.333333 21.333333H64a21.333333 21.333333 0 0 1 0-42.666667h426.666667a21.333333 21.333333 0 0 1 21.333333 21.333334zM64 128h896a21.333333 21.333333 0 0 0 0-42.666667H64a21.333333 21.333333 0 0 0 0 42.666667z m896 341.333333H64a21.333333 21.333333 0 0 0 0 42.666667h896a21.333333 21.333333 0 0 0 0-42.666667z m-100.573333 128A121.866667 121.866667 0 0 0 768 638.586667 121.866667 121.866667 0 0 0 676.573333 597.333333C609.333333 597.333333 554.666667 652 554.666667 719.24c0 29.046667 2.38 56.293333 31.64 95.653333 26.786667 36 75.426667 82.78 167.88 161.333334a21.333333 21.333333 0 0 0 27.626666 0c92.453333-78.58 141.093333-125.333333 167.88-161.333334 29.26-39.333333 31.64-66.606667 31.64-95.653333C981.333333 652 926.666667 597.333333 859.426667 597.333333z" />
                </svg>
              </n-button>
            </n-badge>
          </template>
          <div class="mini-queue-popover">
            <div class="mini-queue-head">
              <strong>{{ t('player.queueTitle') }}</strong>
              <span>{{ queuePosition }} / {{ displayQueue.length || 1 }} · {{ playModeLabel }}</span>
            </div>
            <n-scrollbar style="max-height: 360px">
              <n-list hoverable clickable>
                <n-list-item
                  v-for="(track, index) in displayQueue"
                  :key="track.id"
                  class="mini-queue-item"
                  :class="{ 'is-active': index === displayQueueIndex }"
                  @click="playQueueTrack(index)"
                >
                  <div class="mini-queue-row">
                    <span>{{ index + 1 }}</span>
                    <strong>{{ pickText(track.title, localeStore.locale) }}</strong>
                    <small>{{ track.albumTitle ? pickText(track.albumTitle, localeStore.locale) : 'TWICE' }}</small>
                  </div>
                </n-list-item>
              </n-list>
            </n-scrollbar>
          </div>
        </n-popover>
        <n-button
          v-if="!isMobile"
          quaternary
          circle
          size="large"
          class="mini-audio-minimize-inline"
          :title="t('player.minimize')"
          :aria-label="t('player.minimize')"
          @click="minimizePlayer"
        >
          <svg class="mini-audio-icon mini-audio-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
            <path d="M853.333333 0h-682.666666C75.093333 0 0 75.093333 0 170.666667v682.666666C0 948.906667 75.093333 1024 170.666667 1024h682.666666c95.573333 0 170.666667-75.093333 170.666667-170.666667v-682.666666C1024 75.093333 948.906667 0 853.333333 0zM955.733333 853.333333c0 54.613333-47.786667 102.4-102.4 102.4h-682.666666c-54.613333 0-102.4-47.786667-102.4-102.4v-682.666666C68.266667 116.053333 116.053333 68.266667 170.666667 68.266667h682.666666c54.613333 0 102.4 47.786667 102.4 102.4v682.666666z" />
            <path d="M812.373333 163.84L614.4 361.813333V238.933333c0-20.48-13.653333-34.133333-34.133333-34.133333s-34.133333 13.653333-34.133334 34.133333v204.8c0 20.48 13.653333 34.133333 34.133334 34.133334h204.8c20.48 0 34.133333-13.653333 34.133333-34.133334s-13.653333-34.133333-34.133333-34.133333H662.186667l197.973333-197.973333c13.653333-13.653333 13.653333-34.133333 0-47.786667-13.653333-13.653333-34.133333-13.653333-47.786667 0zM443.733333 546.133333h-204.8c-20.48 0-34.133333 13.653333-34.133333 34.133334s13.653333 34.133333 34.133333 34.133333h122.88l-197.973333 197.973333c-13.653333 13.653333-13.653333 34.133333 0 47.786667 13.653333 13.653333 34.133333 13.653333 47.786667 0L409.6 662.186667v122.88c0 20.48 13.653333 34.133333 34.133333 34.133333s34.133333-13.653333 34.133334-34.133333v-204.8c0-20.48-13.653333-34.133333-34.133334-34.133334z" />
          </svg>
        </n-button>
      </div>
      <div class="mini-audio-progress">
        <span>{{ formatTime(currentTime) }}</span>
        <n-slider v-model:value="progressValue" :max="progressMax" :step="1" :tooltip="false" :disabled="!audioStore.audioUrl" />
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <div class="mini-audio-lyric">
      <LyricsDisplay v-if="audioStore.lrc" :lrc="audioStore.lrc" :current-time="currentTime" />
      <span v-else>{{ t('player.noLyrics') }}</span>
    </div>

    <audio
      ref="audioRef"
      :src="audioStore.audioUrl"
      :preload="isMobile ? 'metadata' : 'auto'"
      @play="audioStore.setPlaying(true)"
      @pause="audioStore.setPlaying(false)"
      @ended="handleEnded"
      @error="audioStore.handleAudioError()"
      @timeupdate="updateTime"
      @loadedmetadata="updateDuration"
      @durationchange="updateDuration"
    />
    <button v-if="isMobile" class="mini-audio-minimize" type="button" @click="minimizePlayer" :title="t('player.minimize')" :aria-label="t('player.minimize')">
      <svg class="mini-audio-action-icon mini-audio-action-icon-filled" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
        <path d="M853.333333 0h-682.666666C75.093333 0 0 75.093333 0 170.666667v682.666666C0 948.906667 75.093333 1024 170.666667 1024h682.666666c95.573333 0 170.666667-75.093333 170.666667-170.666667v-682.666666C1024 75.093333 948.906667 0 853.333333 0zM955.733333 853.333333c0 54.613333-47.786667 102.4-102.4 102.4h-682.666666c-54.613333 0-102.4-47.786667-102.4-102.4v-682.666666C68.266667 116.053333 116.053333 68.266667 170.666667 68.266667h682.666666c54.613333 0 102.4 47.786667 102.4 102.4v682.666666z" />
        <path d="M812.373333 163.84L614.4 361.813333V238.933333c0-20.48-13.653333-34.133333-34.133333-34.133333s-34.133333 13.653333-34.133334 34.133333v204.8c0 20.48 13.653333 34.133333 34.133334 34.133334h204.8c20.48 0 34.133333-13.653333 34.133333-34.133334s-13.653333-34.133333-34.133333-34.133333H662.186667l197.973333-197.973333c13.653333-13.653333 13.653333-34.133333 0-47.786667-13.653333-13.653333-34.133333-13.653333-47.786667 0zM443.733333 546.133333h-204.8c-20.48 0-34.133333 13.653333-34.133333 34.133334s13.653333 34.133333 34.133333 34.133333h122.88l-197.973333 197.973333c-13.653333 13.653333-13.653333 34.133333 0 47.786667 13.653333 13.653333 34.133333 13.653333 47.786667 0L409.6 662.186667v122.88c0 20.48 13.653333 34.133333 34.133333 34.133333s34.133333-13.653333 34.133334-34.133333v-204.8c0-20.48-13.653333-34.133333-34.133334-34.133334z" />
      </svg>
    </button>
    <button class="mini-audio-close" type="button" @click="closePlayer" :title="t('player.close')" :aria-label="t('player.close')">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  </div>

  <n-drawer v-model:show="showQueueDrawer" placement="bottom" height="62vh" class="mini-queue-drawer">
    <n-drawer-content closable>
      <template #header>
        <div class="mini-queue-head">
          <strong>{{ t('player.queueTitle') }}</strong>
          <span>{{ queuePosition }} / {{ displayQueue.length || 1 }} · {{ playModeLabel }}</span>
        </div>
      </template>
      <n-scrollbar style="max-height: calc(62vh - 92px)">
        <n-list hoverable clickable>
          <n-list-item
            v-for="(track, index) in displayQueue"
            :key="track.id"
            class="mini-queue-item"
            :class="{ 'is-active': index === displayQueueIndex }"
            @click="playQueueTrack(index)"
          >
            <div class="mini-queue-row">
              <span>{{ index + 1 }}</span>
              <strong>{{ pickText(track.title, localeStore.locale) }}</strong>
              <small>{{ track.albumTitle ? pickText(track.albumTitle, localeStore.locale) : 'TWICE' }}</small>
            </div>
          </n-list-item>
        </n-list>
      </n-scrollbar>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import { useI18n } from '@/i18n'
import FallbackImage from '@/components/common/FallbackImage.vue'
import { useAudioStore } from '@/stores/audio'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'
import LyricsDisplay from './LyricsDisplay.vue'

const audioStore = useAudioStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const audioRef = ref<HTMLAudioElement | null>(null)
const isMobile = ref(false)
const showQueueDrawer = ref(false)
const currentTime = ref(0)
const duration = ref(0)
const isMinimized = ref(false)
const displayQueue = computed(() => (audioStore.queue.length > 0 ? audioStore.queue : audioStore.currentTrack ? [audioStore.currentTrack] : []))
const displayQueueIndex = computed(() => (audioStore.queueIndex >= 0 ? audioStore.queueIndex : 0))
const queuePosition = computed(() => Math.min(displayQueueIndex.value + 1, displayQueue.value.length || 1))
const canPlayPrevious = computed(() => audioStore.queue.length > 1 && (audioStore.playMode !== 'sequence' || audioStore.queueIndex > 0))
const canPlayNext = computed(() => audioStore.queue.length > 1 && (audioStore.playMode !== 'sequence' || audioStore.queueIndex < audioStore.queue.length - 1))
const playModeLabel = computed(() => {
  if (audioStore.playMode === 'shuffle') return t('player.shuffle')
  if (audioStore.playMode === 'repeat') return t('player.repeat')
  return t('player.sequence')
})
const playButtonLabel = computed(() => (audioStore.loading ? t('player.loading') : audioStore.playing ? t('player.pause') : t('player.play')))
const isCoverSpinning = computed(() => audioStore.playing && !audioStore.loading)
const currentCoverSources = computed(() => {
  const track = audioStore.currentTrack
  return track ? [track.coverLocal, track.coverRemote].filter(Boolean) as string[] : []
})
const progressMax = computed(() => Math.max(duration.value, 1))
const progressValue = computed({
  get: () => currentTime.value,
  set: (value: number) => {
    seekTo(value)
  },
})

function updateMobileState() {
  if (typeof window === 'undefined') return
  isMobile.value = window.matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

onMounted(() => {
  updateMobileState()
  window.addEventListener('resize', updateMobileState, { passive: true })
})

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('resize', updateMobileState)
})

// 更新播放时间
function updateTime() {
  if (audioRef.value) {
    currentTime.value = audioRef.value.currentTime
  }
}

function updateDuration() {
  if (!audioRef.value || Number.isNaN(audioRef.value.duration)) {
    duration.value = 0
    return
  }
  duration.value = audioRef.value.duration
}

function seekTo(value: number) {
  if (!audioRef.value || !Number.isFinite(value)) return
  audioRef.value.currentTime = value
  currentTime.value = value
}

function formatTime(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0:00'
  const minutes = Math.floor(value / 60)
  const seconds = Math.floor(value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
}

function togglePlayback() {
  if (audioStore.loading) return
  audioStore.setPlaying(!audioStore.playing)
}

async function playQueueTrack(index: number) {
  if (audioStore.queue.length === 0 && audioStore.currentTrack) {
    await audioStore.playTrack(audioStore.currentTrack)
  } else {
    await audioStore.playQueueTrack(index)
  }
  showQueueDrawer.value = false
}

function minimizePlayer() {
  showQueueDrawer.value = false
  isMinimized.value = true
}

async function handleEnded() {
  const currentTrackId = audioStore.currentTrack?.id
  await audioStore.handleAudioEnded()
  await nextTick()

  if (audioRef.value && audioStore.playing && audioStore.currentTrack?.id === currentTrackId) {
    audioRef.value.currentTime = 0
    await audioRef.value.play().catch(() => {
      audioStore.setPlaying(false)
    })
  }
}

// 监听 currentTrack 变化，确保组件渲染后尝试播放
watch(() => audioStore.currentTrack, async (newTrack) => {
  if (!newTrack) return
  currentTime.value = 0
  await nextTick()
  await nextTick() // 双重 nextTick 确保 DOM 完全更新

  if (audioRef.value && audioStore.audioUrl && audioStore.playing) {
    try {
      await audioRef.value.play()
    } catch (err) {
      console.error('Initial play failed:', err)
    }
  }
})

watch(() => audioStore.audioUrl, async (newUrl) => {
  if (!newUrl) return
  await nextTick()
  if (!audioRef.value) return

  if (audioStore.playing) {
    try {
      audioRef.value.load()
      await audioRef.value.play()
    } catch (err) {
      console.error('Auto-play failed:', err)
      audioStore.setPlaying(false)
    }
  }
})

watch(() => audioStore.playing, async (shouldPlay) => {
  await nextTick()
  if (!audioRef.value || !audioStore.audioUrl) return

  if (shouldPlay) {
    try {
      await audioRef.value.play()
    } catch (err) {
      console.error('Play failed:', err)
      audioStore.setPlaying(false)
    }
  } else {
    audioRef.value.pause()
  }
})

function closePlayer() {
  isMinimized.value = false
  if (audioRef.value) {
    audioRef.value.pause()
  }
  audioStore.stop()
}
</script>
