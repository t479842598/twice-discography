<template>
  <main class="page">
    <PageHeader eyebrow="单人 / 小分队" title="成员单人和小分队作品" description="成员个人作品与 MISAMO 小分队作品单独整理，包含专辑、EP、单曲和曲目。" />
    <n-tabs type="segment" animated>
      <n-tab-pane name="solo" tab="单人">
        <section class="section">
          <h2>单人专辑 / 单曲</h2>
          <div class="album-grid"><AlbumCard v-for="album in soloAlbums" :key="album.id" :album="album" /></div>
        </section>
        <section class="section"><h2>单人曲目</h2><TrackList :tracks="soloTracks" /></section>
      </n-tab-pane>
      <n-tab-pane name="unit" tab="小分队">
        <section class="section">
          <h2>小分队专辑 / 单曲</h2>
          <div class="album-grid"><AlbumCard v-for="album in unitAlbums" :key="album.id" :album="album" /></div>
        </section>
        <section class="section"><h2>小分队曲目</h2><TrackList :tracks="unitTracks" /></section>
      </n-tab-pane>
    </n-tabs>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api/client'
import type { Album, Track } from '@/api/types'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const tracks = ref<Track[]>([])
const albums = ref<Album[]>([])
const soloAlbums = computed(() => albums.value.filter((album) => /^apple-(nayeon|jihyo|tzuyu)-/.test(album.id)))
const unitAlbums = computed(() => albums.value.filter((album) => album.id.startsWith('apple-misamo') || album.id === 'misamo-masterpiece'))
const soloTracks = computed(() => tracks.value.filter((track) => track.category === 'solo'))
const unitTracks = computed(() => tracks.value.filter((track) => ['unit', 'misamo'].includes(track.category)))

onMounted(async () => {
  const [trackData, albumData] = await Promise.all([api.tracks(), api.albums()])
  tracks.value = trackData.tracks.filter((track) => ['solo', 'unit', 'misamo'].includes(track.category))
  albums.value = albumData.albums
})
</script>

