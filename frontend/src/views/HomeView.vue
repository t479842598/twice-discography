<template>
  <main class="page home-page">
    <section class="home-hero" :class="{ 'is-playing-mv': isHeroMvPlaying }" :style="{ '--hero-image': `url(${activeHeroMv.cover})`, '--hero-aspect': activeHeroMv.aspectRatio }">
      <div class="home-hero-image" aria-hidden="true" />
      <video
        v-if="!isMobile"
        ref="heroVideoRef"
        class="home-hero-video"
        :class="{ 'is-ready': heroVideoReady }"
        :poster="activeHeroMv.cover"
        muted
        loop
        playsinline
        preload="none"
        aria-hidden="true"
        @canplay="heroVideoReady = true"
        @loadeddata="heroVideoReady = true"
        @playing="heroVideoReady = true"
        @error="heroVideoReady = false"
      >
        <source :src="activeHeroMv.video" :type="activeHeroMv.type" />
      </video>
      <video
        v-if="isHeroMvPlaying"
        ref="heroPlayerRef"
        class="home-hero-player"
        :poster="activeHeroMv.cover"
        controls
        playsinline
        @ended="stopHeroPlayer"
      >
        <source :src="activeHeroMv.video" :type="activeHeroMv.type" />
      </video>
      <button v-if="isHeroMvPlaying" class="home-hero-player-close" type="button" :aria-label="t('mv.close')" @click="stopHeroPlayer">×</button>
      <div class="home-hero-shade" />
      <div class="home-hero-content">
        <img class="home-hero-logo" src="/twice-logomark.png" alt="TWICE" width="118" height="118" decoding="async" fetchpriority="high" />
        <p>{{ t('home.heroKicker') }}</p>
        <h1>{{ activeHeroMv.title }}</h1>
        <div class="home-hero-actions">
          <n-button type="primary" size="large" :loading="playingHero" @click="playHeroTrack">{{ t('home.playHero') }}</n-button>
          <n-button v-if="!isHeroMvPlaying" class="home-hero-secondary-button" size="large" @click="openHeroPlayer">{{ t('home.watchMv') }}</n-button>
          <n-button class="home-hero-secondary-button" size="large" secondary @click="$router.push('/albums')">{{ t('home.browseAlbums') }}</n-button>
        </div>
      </div>
    </section>

    <n-grid :cols="statsGridCols" :x-gap="12" :y-gap="12" responsive="screen">
      <n-gi v-for="(value, key) in overview?.stats" :key="key">
        <RouterLink class="stat-block" :to="statRoute(String(key))">
          <span>{{ statLabel(String(key)) }}</span>
          <strong>{{ value }}</strong>
        </RouterLink>
      </n-gi>
    </n-grid>

    <section class="section">
      <div class="section-heading">
        <h2>{{ t('home.timeline') }}</h2>
        <button v-if="canToggleTimeline" class="section-toggle" type="button" :aria-expanded="!isTimelineCollapsed" @click="isTimelineCollapsed = !isTimelineCollapsed">
          <span>{{ isTimelineCollapsed ? t('home.showAll') : t('home.collapse') }}</span>
          <span class="section-toggle-icon" :class="{ 'is-open': !isTimelineCollapsed }">⌄</span>
        </button>
      </div>
      <div class="year-timeline">
        <article
          v-for="(year, index) in visibleYears"
          :key="year.year"
          class="year-chip"
          :class="{ 'is-current': index === 0 }"
        >
          <RouterLink :to="`/years/${year.year}`" class="year-chip-year" :aria-label="t('home.viewYear', { year: year.year })">
            <span class="year-chip-dot" />
            <strong>{{ year.year }}</strong>
          </RouterLink>
          <div class="year-chip-card">
            <RouterLink :to="`/years/${year.year}`" class="year-chip-main">
              <span class="year-chip-summary">{{ t('home.yearSummary', { albums: year.albums.length, tracks: year.tracks.length }) }}</span>
              <small v-if="yearTopAlbum(year)">{{ yearTopAlbum(year) }}</small>
            </RouterLink>
            <div class="year-hot-tracks">
              <span class="year-hot-title">{{ t('home.hotSongs') }}</span>
              <div v-if="yearHotTracks(year).length" class="year-hot-list">
                <RouterLink v-for="track in yearHotTracks(year)" :key="track.id" :to="`/tracks/${track.id}`" class="year-hot-track">
                  {{ pickText(track.title, localeStore.locale) }}
                </RouterLink>
              </div>
              <span v-else class="year-hot-empty">{{ t('home.noHotSongs') }}</span>
            </div>
            <RouterLink :to="`/years/${year.year}`" class="year-view-link">
              {{ t('home.viewYear', { year: year.year }) }}
            </RouterLink>
          </div>
        </article>
      </div>
    </section>

    <section class="section">
      <div class="section-heading">
        <h2>{{ t('home.featuredAlbums') }}</h2>
        <button v-if="canToggleAlbums" class="section-toggle" type="button" :aria-expanded="!isAlbumsCollapsed" @click="isAlbumsCollapsed = !isAlbumsCollapsed">
          <span>{{ isAlbumsCollapsed ? t('home.showAll') : t('home.collapse') }}</span>
          <span class="section-toggle-icon" :class="{ 'is-open': !isAlbumsCollapsed }">⌄</span>
        </button>
      </div>
      <div class="album-grid">
        <AlbumCard v-for="album in visibleFeaturedAlbums" :key="album.id" :album="album" />
      </div>
    </section>

    <section class="section">
      <h2>{{ t('home.quickPlay') }}</h2>
      <TrackList :tracks="overview?.featuredTracks || []" />
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AlbumCard from '@/components/catalog/AlbumCard.vue'
import TrackList from '@/components/catalog/TrackList.vue'
import { api } from '@/api/client'
import type { CatalogOverview, Track } from '@/api/types'
import { useI18n } from '@/i18n'
import { useAudioStore } from '@/stores/audio'
import { useCatalogStore } from '@/stores/catalog'
import { useLocaleStore } from '@/stores/locale'
import { pickText } from '@/utils/text'

const catalog = useCatalogStore()
const audioStore = useAudioStore()
const localeStore = useLocaleStore()
const { t } = useI18n()
const overview = computed(() => catalog.overview)
const heroTrack = ref<Track | null>(null)
const playingHero = ref(false)
const heroVideoReady = ref(false)
const heroVideoRef = ref<HTMLVideoElement | null>(null)
const heroPlayerRef = ref<HTMLVideoElement | null>(null)
const isHeroMvPlaying = ref(false)
const isTimelineCollapsed = ref(true)
const isAlbumsCollapsed = ref(true)
const albumPreviewCount = ref(5)
const heroMvs = [
  {
    title: 'ME+YOU',
    trackId: 'apple-twice-1840284140',
    cover: 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg',
    video: import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4',
    aspectRatio: '16 / 9',
  },
]
const activeHeroMvIndex = ref(0)
const activeHeroMv = computed(() => {
  const mv = heroMvs[activeHeroMvIndex.value] || heroMvs[0]
  return {
    ...mv,
    type: mv.video.endsWith('.webm') ? 'video/webm' : 'video/mp4',
  }
})
const isMobile = ref(detectMobile())
const statKeys = {
  albums: 'stats.albums',
  tracks: 'stats.tracks',
  members: 'stats.members',
  cfs: 'stats.cfs',
  covers: 'stats.covers',
  solos: 'stats.solos',
  units: 'stats.units',
} as const

const statRoutes = {
  albums: '/albums',
  tracks: '/albums',
  members: '/members',
  cfs: '/cfs',
  covers: '/covers',
  solos: '/solo-unit',
  units: '/solo-unit',
} as const

const statsGridCols = 'xs:2 s:3 m:4 l:7 xl:7 2xl:7'
const visibleYears = computed(() => {
  const years = overview.value?.years || []
  return isTimelineCollapsed.value ? years.slice(0, 3) : years
})
const visibleFeaturedAlbums = computed(() => {
  const albums = overview.value?.featuredAlbums || []
  return isAlbumsCollapsed.value ? albums.slice(0, albumPreviewCount.value) : albums
})
const canToggleTimeline = computed(() => (overview.value?.years.length || 0) > 3)
const canToggleAlbums = computed(() => (overview.value?.featuredAlbums.length || 0) > albumPreviewCount.value)

function statLabel(key: string) {
  const messageKey = statKeys[key as keyof typeof statKeys]
  return messageKey ? t(messageKey) : key
}

function statRoute(key: string) {
  return statRoutes[key as keyof typeof statRoutes] || '/albums'
}

function yearTopAlbum(year: CatalogOverview['years'][number]) {
  const album = year.albums[0]
  return album ? album.title.zh || album.title.en : ''
}

function yearHotTracks(year: CatalogOverview['years'][number]) {
  const titleTracks = year.tracks.filter((track) => track.isTitle)
  const fallbackTracks = year.tracks.filter((track) => !track.isTitle)
  return [...titleTracks, ...fallbackTracks].slice(0, 3)
}

onMounted(() => {
  updateResponsiveState()
  window.addEventListener('resize', updateResponsiveState)
  void catalog.loadOverview()
  // 移动端不预加载音频
  if (!isMobile.value) {
    void warmHeroTrack()
    void startHeroVideo()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateResponsiveState)
})

function updateResponsiveState() {
  isMobile.value = detectMobile()
  albumPreviewCount.value = detectAlbumPreviewCount()
}

function detectAlbumPreviewCount() {
  if (typeof window === 'undefined') return 5
  if (window.innerWidth < 520) return 2
  if (window.innerWidth < 920) return 2
  if (window.innerWidth < 1180) return 3
  return 5
}

function detectMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

async function startHeroVideo() {
  await nextTick()
  if (!heroVideoRef.value) return
  if (heroVideoRef.value.readyState >= 2) {
    heroVideoReady.value = true
  }
  void heroVideoRef.value.play().catch(() => {
    heroVideoReady.value = heroVideoRef.value ? heroVideoRef.value.readyState >= 2 : false
  })
}

async function openHeroPlayer() {
  isHeroMvPlaying.value = true
  heroVideoRef.value?.pause()
  await nextTick()
  if (!heroPlayerRef.value) return
  heroPlayerRef.value.currentTime = 0
  void heroPlayerRef.value.play().catch(() => {})
}

function stopHeroPlayer() {
  heroPlayerRef.value?.pause()
  isHeroMvPlaying.value = false
  if (!isMobile.value) {
    void startHeroVideo()
  }
}

async function playHeroTrack() {
  playingHero.value = true
  try {
    const track = heroTrack.value || (await api.track(activeHeroMv.value.trackId)).track
    heroTrack.value = track
    await audioStore.playTrack(track)
  } finally {
    playingHero.value = false
  }
}

async function warmHeroTrack() {
  try {
    heroTrack.value = (await api.track(activeHeroMv.value.trackId)).track
    await audioStore.prefetchTrack(heroTrack.value)
  } catch {
    // The hero stays usable even if music warmup fails.
  }
}
</script>

