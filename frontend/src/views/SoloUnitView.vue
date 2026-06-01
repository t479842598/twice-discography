<template>
  <main class="page">
    <PageHeader :eyebrow="t('page.solo.eyebrow')" :title="t('page.solo.title')" :description="t('page.solo.description')" />
    <n-tabs type="segment" animated>
      <n-tab-pane name="solo" :tab="t('page.solo.tabSolo')">
        <section class="section">
          <h2>{{ t('page.solo.soloAlbums') }}</h2>
          <div class="album-grid"><AlbumCard v-for="album in soloAlbums" :key="album.id" :album="album" /></div>
        </section>
        <section class="section"><h2>{{ t('page.solo.soloTracks') }}</h2><TrackList :tracks="soloTracks" /></section>
      </n-tab-pane>
      <n-tab-pane name="unit" :tab="t('page.solo.tabUnit')">
        <section class="section">
          <h2>{{ t('page.solo.unitAlbums') }}</h2>
          <div class="album-grid"><AlbumCard v-for="album in unitAlbums" :key="album.id" :album="album" /></div>
        </section>
        <section class="section"><h2>{{ t('page.solo.unitTracks') }}</h2><TrackList :tracks="unitTracks" /></section>
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
import { useI18n } from '@/i18n'

const tracks = ref<Track[]>([])
const albums = ref<Album[]>([])
const { t } = useI18n()
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

