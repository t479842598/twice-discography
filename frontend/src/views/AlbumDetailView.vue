<template>
  <main class="page">
    <PageHeader
      v-if="album"
      :eyebrow="`${album.year} · ${albumTypeLabel(album.type, localeStore.locale)}`"
      :title="pickText(album.title, localeStore.locale)"
      :description="pickText(album.description, localeStore.locale)"
    />
    <n-skeleton v-else text :repeat="4" />

    <section v-if="album" class="section album-detail-grid">
      <FallbackImage
        v-if="coverSources.length"
        class="album-detail-cover"
        :sources="coverSources"
        :alt="t('common.coverAlt', { title: pickText(album.title, localeStore.locale) })"
        decoding="async"
        fetchpriority="high"
      />
      <div>
        <h2>{{ t('album.tracks') }}</h2>
        <TrackList :tracks="album.tracks || []" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { Album } from '@/api/types'
import TrackList from '@/components/catalog/TrackList.vue'
import FallbackImage from '@/components/common/FallbackImage.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useI18n } from '@/i18n'
import { useLocaleStore } from '@/stores/locale'
import { albumTypeLabel, pickText } from '@/utils/text'

const route = useRoute()
const localeStore = useLocaleStore()
const { t } = useI18n()
const album = ref<Album | null>(null)
const coverSources = computed(() => (album.value ? [album.value.coverLocal, album.value.coverRemote].filter(Boolean) as string[] : []))

async function load() {
  album.value = (await api.album(String(route.params.id))).album
}

onMounted(load)
watch(() => route.params.id, load)
</script>

