<template>
  <main class="page home-page">
    <section class="home-hero" :style="{ '--hero-image': `url(${heroImage})` }">
      <div class="home-hero-image" aria-hidden="true" />
      <video
        class="home-hero-video"
        :class="{ 'is-ready': heroVideoReady }"
        :poster="heroImage"
        autoplay
        muted
        loop
        playsinline
        preload="metadata"
        aria-hidden="true"
        @canplay="heroVideoReady = true"
        @error="heroVideoReady = false"
      >
        <source :src="heroVideo" :type="heroVideoType" />
      </video>
      <div class="home-hero-shade" />
      <div class="home-hero-content">
        <img class="home-hero-logo" src="/twice-logomark.png" alt="TWICE" />
        <p>TWICE · TEN: The Story Goes On</p>
        <h1>ME+YOU</h1>
        <div class="home-hero-actions">
          <n-button type="primary" size="large" :loading="playingHero" @click="playHeroTrack">播放 ME+YOU</n-button>
          <n-button size="large" tag="a" href="https://youtu.be/zqorlX_5oHQ" target="_blank" rel="noopener noreferrer">
            观看 MV
          </n-button>
          <n-button size="large" secondary @click="$router.push('/albums')">浏览专辑</n-button>
        </div>
      </div>
    </section>

    <n-grid :cols="4" :x-gap="16" :y-gap="16" responsive="screen">
      <n-gi v-for="(value, key) in overview?.stats" :key="key">
        <div class="stat-block">
          <span>{{ statLabels[key] || key }}</span>
          <strong>{{ value }}</strong>
        </div>
      </n-gi>
    </n-grid>

    <section class="section">
      <h2>年份时间线</h2>
      <div class="year-timeline">
        <RouterLink v-for="year in overview?.years" :key="year.year" :to="`/years/${year.year}`" class="year-chip">
          <strong>{{ year.year }}</strong>
          <span>{{ year.albums.length }} 专辑 · {{ year.tracks.length }} 首歌</span>
        </RouterLink>
      </div>
    </section>

    <section class="section">
      <h2>代表专辑</h2>
      <div class="album-grid">
        <AlbumCard v-for="album in overview?.featuredAlbums" :key="album.id" :album="album" />
      </div>
    </section>

    <section class="section">
      <h2>标题曲快速播放</h2>
      <TrackList :tracks="overview?.featuredTracks || []" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import { api } from '@/api/client'
import type { Track } from '@/api/types'
import { useAudioStore } from '@/stores/audio'
import { useCatalogStore } from '@/stores/catalog'

const catalog = useCatalogStore()
const audioStore = useAudioStore()
const overview = computed(() => catalog.overview)
const heroTrack = ref<Track | null>(null)
const playingHero = ref(false)
const heroVideoReady = ref(false)
const heroImage = 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg'
const heroVideo = import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4'
const heroVideoType = heroVideo.endsWith('.webm') ? 'video/webm' : 'video/mp4'
const statLabels: Record<string, string> = {
  albums: '专辑',
  tracks: '歌曲',
  members: '成员',
  cfs: '广告曲',
  covers: '翻唱',
  solos: '单人',
  units: '小分队',
}

onMounted(() => {
  void catalog.loadOverview()
  void warmHeroTrack()
})

async function playHeroTrack() {
  playingHero.value = true
  try {
    const track = heroTrack.value || (await api.track('apple-twice-1840284140')).track
    heroTrack.value = track
    await audioStore.playTrack(track)
  } finally {
    playingHero.value = false
  }
}

async function warmHeroTrack() {
  try {
    heroTrack.value = (await api.track('apple-twice-1840284140')).track
    await audioStore.prefetchTrack(heroTrack.value)
  } catch {
    // The hero stays usable even if music warmup fails.
  }
}
</script>

