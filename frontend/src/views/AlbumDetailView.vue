<template>
  <main class="page">
    <PageHeader
      v-if="album"
      :eyebrow="`${album.year} · ${album.type}`"
      :title="pickText(album.title, localeStore.locale)"
      :description="pickText(album.description, localeStore.locale)"
    />
    <n-skeleton v-else text :repeat="4" />

    <section v-if="album" class="section album-detail-grid">
      <img
        v-if="album.coverLocal"
        class="album-detail-cover"
        :src="album.coverLocal"
        :alt="`${pickText(album.title, localeStore.locale)} cover`"
      />
      <div>
        <h2>曲目</h2>
        <TrackList :tracks="album.tracks || []" />
      </div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '@/api/client'
import type { Album } from '@/api/types'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const route = useRoute()
const localeStore = useLocaleStore()
const album = ref<Album | null>(null)

async function load() {
  album.value = (await api.album(String(route.params.id))).album
}

onMounted(load)
watch(() => route.params.id, load)
</script>

