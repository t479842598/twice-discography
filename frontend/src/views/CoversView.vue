<template>
  <main class="page">
    <PageHeader :eyebrow="t('page.covers.eyebrow')" :title="t('page.covers.title')" :description="t('page.covers.description')" />
    <section class="section">
      <h2>{{ t('page.covers.playable') }}</h2>
      <TrackList :tracks="coverTracks" />
    </section>
    <section class="section">
      <h2>{{ t('page.covers.archive') }}</h2>
      <div class="list-grid">
        <n-card v-for="cover in covers" :key="cover.id" :title="cover.originalSong" :class="{ 'is-highlighted': highlightedId === cover.id }">
          <n-space>
            <n-tag size="small" :bordered="false">{{ cover.year }}</n-tag>
            <n-tag v-if="cover.isPredebut" size="small" type="warning">{{ t('category.predebut') }}</n-tag>
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
import { useI18n } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const { t } = useI18n()
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


