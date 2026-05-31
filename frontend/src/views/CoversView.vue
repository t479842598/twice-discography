<template>
  <main class="page">
    <PageHeader eyebrow="翻唱" title="翻唱 / 预出道" description="舞台翻唱、特别表演和预出道资料，支持直接播放。" />
    <section class="section">
      <h2>可播放曲目</h2>
      <TrackList :tracks="coverTracks" />
    </section>
    <section class="section">
      <h2>翻唱资料</h2>
      <div class="list-grid">
        <n-card v-for="cover in covers" :key="cover.id" :title="cover.originalSong" :class="{ 'is-highlighted': highlightedId === cover.id }">
          <n-space>
            <n-tag size="small" :bordered="false">{{ cover.year }}</n-tag>
            <n-tag v-if="cover.isPredebut" size="small" type="warning">预出道</n-tag>
          </n-space>
          <p>{{ cover.originalArtist }} · {{ cover.performedAt }}</p>
          <p>{{ pickText(cover.note, localeStore.locale) }}</p>
        </n-card>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { Cover, Track } from '@/api/types'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const route = useRoute()
const covers = ref<Cover[]>([])
const coverTracks = ref<Track[]>([])
const highlightedId = computed(() => String(route.query.highlight || ''))

onMounted(async () => {
  const [coverData, trackData] = await Promise.all([api.covers(), api.tracks()])
  covers.value = coverData.covers
  coverTracks.value = trackData.tracks.filter((track) => ['cover', 'predebut'].includes(track.category))
})
</script>


