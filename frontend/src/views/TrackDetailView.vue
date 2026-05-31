<template>
  <main class="page">
    <PageHeader
      v-if="track"
      :eyebrow="track.albumTitle ? pickText(track.albumTitle, localeStore.locale) : categoryLabel(track.category)"
      :title="pickText(track.title, localeStore.locale)"
      :description="pickText(track.note, localeStore.locale)"
    >
      <template #actions>
        <n-button type="primary" :loading="audioStore.loading" @click="audioStore.playTrack(track)">播放最佳音源</n-button>
      </template>
    </PageHeader>

    <img
      v-if="track?.coverLocal"
      class="track-hero-cover"
      :src="track.coverLocal"
      :alt="`${pickText(track.title, localeStore.locale)} cover`"
      decoding="async"
      fetchpriority="high"
    />

    <n-grid v-if="track" :cols="trackGridCols" :x-gap="20" :y-gap="20" responsive="screen" class="track-detail-grid">
      <n-gi class="track-info-cell">
        <section class="panel">
          <h2>歌曲信息</h2>
          <p>分类：{{ categoryLabel(track.category) }}</p>
          <p>时长：{{ formatDuration(track.durationSec) }}</p>
          <p>音乐搜索：{{ track.musicSquareQuery }}</p>
        </section>
      </n-gi>
      <n-gi class="track-sources-cell">
        <section class="panel">
          <h2>多源音乐</h2>
          <MusicSourceList
            :candidates="audioStore.candidates"
            :failed-sources="audioStore.failedSources"
            @select="(source) => audioStore.playTrack(track!, source)"
          />
        </section>
      </n-gi>
    </n-grid>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { Track } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import MusicSourceList from '@/components/player/MusicSourceList.vue'
import { useAudioStore } from '@/stores/audio'
import { useLocaleStore } from '@/stores/locale'
import { categoryLabel, formatDuration, pickText } from '@/utils/text'

const route = useRoute()
const localeStore = useLocaleStore()
const audioStore = useAudioStore()
const track = ref<Track | null>(null)

// 移动端使用单列，桌面端使用双列
const trackGridCols = 'xs:1 s:1 m:2 l:2 xl:2 2xl:2'

async function load() {
  track.value = (await api.track(String(route.params.id))).track
  await audioStore.loadTrack(track.value)
  if (route.query.autoplay === '1' || route.query.autoplay === 'true') {
    await audioStore.playTrack(track.value)
  }
}

onMounted(load)
watch(() => route.params.id, load)
</script>
