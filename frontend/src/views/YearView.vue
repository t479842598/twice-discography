<template>
  <main class="page">
    <PageHeader :eyebrow="`${year} Timeline`" :title="t('year.title', { year })" :description="yearDescription" />

    <section class="section">
      <h2>{{ t('year.albums') }}</h2>
      <div class="album-grid">
        <AlbumCard v-for="album in yearData?.albums" :key="album.id" :album="album" />
      </div>
      <n-empty v-if="!yearData?.albums.length" :description="t('year.emptyAlbums')" />
    </section>

    <section class="section">
      <h2>{{ t('year.tracks') }}</h2>
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
import { useI18n } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'
import { useCatalogStore } from '@/stores/catalog'
import { pickText } from '@/utils/text'

const route = useRoute()
const catalog = useCatalogStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const year = computed(() => Number(route.params.year))
const yearData = computed(() => catalog.overview?.years.find((item) => item.year === year.value))
const yearDescription = computed(() => {
  const data = yearData.value
  if (!data) return t('year.pending')

  const titleTracks = data.tracks.filter((track) => track.isTitle)
  const representativeTracks = (titleTracks.length > 0 ? titleTracks : data.tracks).slice(0, 6)
  const songNames = Array.from(new Set(representativeTracks.map((track) => pickText(track.title, localeStore.locale)))).filter(Boolean)
  const songs = joinList(songNames)
  const songSummary = songNames.length > 0
    ? t(data.tracks.length > songNames.length ? 'year.representativeSongsMore' : 'year.representativeSongs', { songs })
    : t('year.noSongEntries')
  const releaseSummary = t('year.releaseSummary', { albums: data.albums.length, tracks: data.tracks.length })
  const extraSummary = [
    data.cfs.length ? t('year.extraCf', { count: data.cfs.length }) : '',
    data.covers.length ? t('year.extraCover', { count: data.covers.length }) : '',
  ].filter(Boolean).join(localeStore.locale === 'en-US' ? ', ' : '，')

  return t('year.description', {
    year: year.value,
    releases: releaseSummary,
    songs: songSummary,
    extra: extraSummary ? t('year.extraPrefix', { extra: extraSummary }) : '',
  })
})

function joinList(items: string[]) {
  if (localeStore.locale === 'en-US' || localeStore.locale === 'ko-KR') return items.join(', ')
  return items.join('、')
}

onMounted(() => {
  void catalog.loadOverview()
})
</script>

