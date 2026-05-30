<template>
  <main class="page">
    <PageHeader eyebrow="搜索" title="全局搜索" description="搜索专辑、歌曲、成员、广告合作和翻唱。" />
    <n-input-group class="search-box">
      <n-input v-model:value="query" placeholder="输入 FANCY / Nayeon / MISAMO" @keyup.enter="runSearch" />
      <n-button type="primary" :loading="loading" @click="runSearch">搜索</n-button>
    </n-input-group>

    <section v-if="results" class="section">
      <h2>歌曲</h2>
      <TrackList :tracks="results.tracks" />
      <h2>专辑</h2>
      <div class="album-grid"><AlbumCard v-for="album in results.albums" :key="album.id" :album="album" /></div>
      <h2>成员</h2>
      <div class="member-grid"><MemberCard v-for="member in results.members" :key="member.id" :member="member" /></div>
    </section>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { api } from '@/api/client'
import type { Album, CfSong, Cover, Member, Track } from '@/api/types'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import MemberCard from '@/components/catalog/MemberCard.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import PageHeader from '@/components/common/PageHeader.vue'

const query = ref('')
const loading = ref(false)
const results = ref<{ albums: Album[]; tracks: Track[]; members: Member[]; cfs: CfSong[]; covers: Cover[] } | null>(null)

async function runSearch() {
  if (!query.value.trim()) return
  loading.value = true
  try {
    results.value = (await api.search(query.value.trim())).results
  } finally {
    loading.value = false
  }
}
</script>

