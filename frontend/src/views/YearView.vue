<template>
  <main class="page">
    <PageHeader :eyebrow="`${year} Timeline`" :title="`${year} 年发行`" :description="yearDescription" />

    <section class="section">
      <h2>专辑</h2>
      <div class="album-grid">
        <AlbumCard v-for="album in yearData?.albums" :key="album.id" :album="album" />
      </div>
      <n-empty v-if="!yearData?.albums.length" description="这一年暂无专辑数据" />
    </section>

    <section class="section">
      <h2>歌曲</h2>
      <TrackList :tracks="yearData?.tracks || []" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useLocaleStore } from '@/stores/locale'
import { useCatalogStore } from '@/stores/catalog'
import { pickText } from '@/utils/text'

const route = useRoute()
const catalog = useCatalogStore()
const localeStore = useLocaleStore()
const year = computed(() => Number(route.params.year))
const yearData = computed(() => catalog.overview?.years.find((item) => item.year === year.value))
const yearDescription = computed(() => {
  const data = yearData.value
  if (!data) return '正在整理这一年的专辑、标题曲、广告歌曲和翻唱记录。'

  const titleTracks = data.tracks.filter((track) => track.isTitle)
  const representativeTracks = (titleTracks.length > 0 ? titleTracks : data.tracks).slice(0, 6)
  const songNames = Array.from(new Set(representativeTracks.map((track) => pickText(track.title, localeStore.locale)))).filter(Boolean)
  const songSummary = songNames.length > 0 ? `代表歌曲包括 ${songNames.join('、')}${data.tracks.length > songNames.length ? ' 等' : ''}` : '暂无歌曲条目'
  const releaseSummary = `${data.albums.length} 张专辑 / 单曲、${data.tracks.length} 首歌曲`
  const extraSummary = [
    data.cfs.length ? `${data.cfs.length} 首广告曲` : '',
    data.covers.length ? `${data.covers.length} 条翻唱 / 预出道记录` : '',
  ].filter(Boolean).join('，')

  return `${year.value} 年收录 ${releaseSummary}；${songSummary}${extraSummary ? `；另有 ${extraSummary}` : ''}。`
})

onMounted(() => {
  void catalog.loadOverview()
})
</script>

