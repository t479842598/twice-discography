<template>
  <main class="page">
    <PageHeader eyebrow="团体专辑" title="TWICE 团体专辑" description="这里只收录 TWICE 团体名义发行的韩语、日语专辑与单曲。" />
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

const albums = ref<Album[]>([])
const groupAlbums = computed(() => albums.value.filter((album) => album.id.startsWith('apple-twice') || (!album.id.startsWith('apple-') && album.type !== 'unit')))

onMounted(async () => {
  albums.value = (await api.albums()).albums
})
</script>

