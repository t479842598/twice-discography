<template>
  <main class="page">
    <PageHeader :eyebrow="t('page.albums.eyebrow')" :title="t('page.albums.title')" :description="t('page.albums.description')" />
    <div class="album-grid">
      <AlbumCard v-for="album in groupAlbums" :key="album.id" :album="album" />
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { api } from '@/api/client'
import type { Album } from '@/api/types'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useI18n } from '@/i18n'

const albums = ref<Album[]>([])
const { t } = useI18n()
const groupAlbums = computed(() => albums.value.filter((album) => album.id.startsWith('apple-twice') || (!album.id.startsWith('apple-') && album.type !== 'unit')))

onMounted(async () => {
  albums.value = (await api.albums()).albums
})
</script>

