<template>
  <n-list bordered hoverable class="track-list">
    <n-list-item v-for="track in tracks" :key="track.id">
      <div class="track-row" @mouseenter="audioStore.prefetchTrack(track)" @focusin="audioStore.prefetchTrack(track)">
        <img v-if="track.coverLocal" class="track-cover" :src="track.coverLocal" :alt="`${pickText(track.title, localeStore.locale)} cover`" loading="lazy" />
        <div v-else class="track-index">{{ track.trackNo || categoryLabel(track.category) }}</div>
        <div class="track-main">
          <RouterLink :to="`/tracks/${track.id}`" class="track-title">
            {{ pickText(track.title, localeStore.locale) }}
          </RouterLink>
          <p>
            <span v-if="track.albumTitle">{{ pickText(track.albumTitle, localeStore.locale) }}</span>
            <span v-else>{{ categoryLabel(track.category) }}</span>
            <span> · {{ formatDuration(track.durationSec) }}</span>
          </p>
        </div>
        <div class="track-badge-cell">
          <n-tag v-if="track.isTitle" size="small" type="error" :bordered="false">主打</n-tag>
        </div>
        <n-button class="track-play-button" circle size="small" secondary :aria-label="`播放 ${pickText(track.title, localeStore.locale)}`" @mouseenter="audioStore.prefetchTrack(track)" @click="audioStore.playTrack(track)">
          ▶
        </n-button>
      </div>
    </n-list-item>
  </n-list>
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { RouterLink } from 'vue-router'
import type { Track } from '@/api/types'
import { useAudioStore } from '@/stores/audio'
import { useLocaleStore } from '@/stores/locale'
import { categoryLabel, formatDuration, pickText } from '@/utils/text'

const props = defineProps<{ tracks: Track[] }>()

const audioStore = useAudioStore()
const localeStore = useLocaleStore()

function prefetchVisibleTracks() {
  for (const track of props.tracks.slice(0, 8)) {
    void audioStore.prefetchTrack(track)
  }
}

onMounted(prefetchVisibleTracks)
watch(() => props.tracks, prefetchVisibleTracks)
</script>
