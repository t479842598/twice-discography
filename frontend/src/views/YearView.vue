<template>
  <main class="page">
    <PageHeader :eyebrow="`${year} Timeline`" :title="`${year} 年发行`" description="按发行年份整理这一年的专辑、标题曲、广告歌曲和翻唱记录。" />

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
import { useCatalogStore } from '@/stores/catalog'

const route = useRoute()
const catalog = useCatalogStore()
const year = computed(() => Number(route.params.year))
const yearData = computed(() => catalog.overview?.years.find((item) => item.year === year.value))

onMounted(() => {
  void catalog.loadOverview()
})
</script>

