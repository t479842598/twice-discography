<template>
  <n-list bordered hoverable class="track-list">
    <n-list-item v-for="track in tracks" :key="track.id">
      <div class="track-row" @mouseenter="audioStore.prefetchTrack(track)" @focusin="audioStore.prefetchTrack(track)">
        <RouterLink :to="`/tracks/${track.id}`" class="track-cover-link">
          <FallbackImage
            v-if="trackCoverSources(track).length"
            class="track-cover"
            :sources="trackCoverSources(track)"
            :alt="`${pickText(track.title, localeStore.locale)} cover`"
            loading="lazy"
            decoding="async"
          />
          <div v-else class="track-index">{{ track.trackNo || '♪' }}</div>
        </RouterLink>
        <div class="track-main">
          <div class="track-title-wrapper">
            <RouterLink :to="`/tracks/${track.id}`" class="track-title">
              {{ pickText(track.title, localeStore.locale) }}
            </RouterLink>
            <n-button
              v-if="track.ytVideoId || track.biliBvid"
              text
              size="tiny"
              class="mv-badge"
              @click.stop="openMv(track)"
            >
              🎬 MV
            </n-button>
          </div>
          <p>
            <span v-if="track.albumTitle">{{ pickText(track.albumTitle, localeStore.locale) }}</span>
            <span v-else>{{ categoryLabel(track.category, localeStore.locale) }}</span>
            <span> · {{ formatDuration(track.durationSec) }}</span>
          </p>
        </div>
        <div class="track-badge-cell">
          <n-tag v-if="track.isTitle" size="small" type="error" :bordered="false">{{ t('track.titleTrack') }}</n-tag>
        </div>
        <n-button class="track-play-button" circle size="small" secondary :aria-label="t('track.playAria', { title: pickText(track.title, localeStore.locale) })" @mouseenter="audioStore.prefetchTrack(track)" @click.stop="audioStore.playTrackFromList(track, tracks)">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </n-button>
      </div>
    </n-list-item>
  </n-list>

  <MvPlayer
    v-model:show="showMvPlayer"
    :title="currentMvTrack ? pickText(currentMvTrack.title, localeStore.locale) : ''"
    :track-id="currentMvTrack?.id"
    :yt-video-id="currentMvTrack?.ytVideoId"
    :bili-bvid="currentMvTrack?.biliBvid"
    :bili-page="currentMvTrack?.biliPage"
  />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Track } from '@/api/types'
import FallbackImage from '@/components/common/FallbackImage.vue'
import MvPlayer from '@/components/player/MvPlayer.vue'
import { useI18n } from '@/i18n'
import { useAudioStore } from '@/stores/audio'
import { useLocaleStore } from '@/stores/locale'
import { categoryLabel, formatDuration, pickText } from '@/utils/text'

const props = defineProps<{ tracks: Track[] }>()

const audioStore = useAudioStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const showMvPlayer = ref(false)
const currentMvTrack = ref<Track | null>(null)

function prefetchVisibleTracks() {
  for (const track of props.tracks.slice(0, 8)) {
    void audioStore.prefetchTrack(track)
  }
}

function openMv(track: Track) {
  currentMvTrack.value = track
  showMvPlayer.value = true
}

function trackCoverSources(track: Track) {
  return [track.coverLocal, track.coverRemote].filter(Boolean) as string[]
}

onMounted(prefetchVisibleTracks)
watch(() => props.tracks, prefetchVisibleTracks)
</script>

<style scoped>
.track-title-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
}

.track-cover-link {
  display: block;
  text-decoration: none;
}

.mv-badge {
  flex-shrink: 0;
  padding: 2px 6px !important;
  font-size: 11px !important;
  line-height: 1 !important;
  color: var(--accent-strong) !important;
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.15), rgba(255, 179, 217, 0.12)) !important;
  border-radius: 4px !important;
  transition: all 0.2s ease !important;
}

.mv-badge:hover {
  background: linear-gradient(135deg, rgba(255, 107, 157, 0.25), rgba(255, 179, 217, 0.22)) !important;
  transform: scale(1.05);
}
</style>


