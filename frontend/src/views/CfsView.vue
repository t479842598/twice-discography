<template>
  <main class="page">
    <PageHeader :eyebrow="t('page.cfs.eyebrow')" :title="t('page.cfs.title')" :description="t('page.cfs.description')" />
    <section class="section">
      <h2>{{ t('page.cfs.playable') }}</h2>
      <TrackList :tracks="cfTracks" />
    </section>
    <section class="section">
      <h2>{{ t('page.cfs.archive') }}</h2>
      <div class="list-grid">
        <n-card v-for="cf in cfs" :key="cf.id" :title="cf.brand" :class="{ 'is-highlighted': highlightedId === cf.id }">
          <n-tag size="small" :bordered="false">{{ cf.year }}</n-tag>
          <h3>{{ pickText(cf.title, localeStore.locale) }}</h3>
          <p>{{ pickText(cf.description, localeStore.locale) }}</p>
        </n-card>
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { CfSong, Track } from '@/api/types'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useI18n } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const { t } = useI18n()
const route = useRoute()
const cfs = ref<CfSong[]>([])
const cfTracks = ref<Track[]>([])
const highlightedId = computed(() => String(route.query.highlight || ''))

onMounted(async () => {
  const [cfData, trackData] = await Promise.all([api.cfs(), api.tracks()])
  cfs.value = cfData.cfs
  cfTracks.value = trackData.tracks.filter((track) => track.category === 'cf')
})
</script>

