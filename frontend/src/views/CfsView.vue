<template>
  <main class="page">
    <PageHeader eyebrow="广告曲" title="广告歌曲 / 合作曲" description="广告合作、品牌主题曲和特殊企划歌曲，支持直接播放。" />
    <section class="section">
      <h2>可播放曲目</h2>
      <TrackList :tracks="cfTracks" />
    </section>
    <section class="section">
      <h2>合作资料</h2>
      <div class="list-grid">
        <n-card v-for="cf in cfs" :key="cf.id" :title="cf.brand">
          <n-tag size="small" :bordered="false">{{ cf.year }}</n-tag>
          <h3>{{ pickText(cf.title, localeStore.locale) }}</h3>
          <p>{{ pickText(cf.description, localeStore.locale) }}</p>
        </n-card>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { api } from '@/api/client'
import type { CfSong, Track } from '@/api/types'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const cfs = ref<CfSong[]>([])
const cfTracks = ref<Track[]>([])

onMounted(async () => {
  const [cfData, trackData] = await Promise.all([api.cfs(), api.tracks()])
  cfs.value = cfData.cfs
  cfTracks.value = trackData.tracks.filter((track) => track.category === 'cf')
})
</script>

