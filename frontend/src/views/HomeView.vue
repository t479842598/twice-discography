<template>
  <main class="page home-page">
    <!-- 精选 MV 轮播 -->
    <section v-if="featuredMvs.length > 0" class="home-hero home-hero-carousel" :style="{ '--hero-image': `url(${carouselCovers.current})` }" @mouseenter="pauseCarousel" @mouseleave="resumeCarousel">
      <div class="home-hero-image" aria-hidden="true" />
      <div class="home-hero-image home-hero-image--next" :class="{ 'is-visible': carouselCovers.nextVisible }" :style="{ backgroundImage: carouselCovers.nextVisible ? `url(${carouselCovers.next})` : 'none' }" aria-hidden="true" />
      <div class="home-hero-shade" />
      <div class="home-hero-content">
        <img class="home-hero-logo" src="/twice-logomark.png" alt="TWICE" width="118" height="118" decoding="async" fetchpriority="high" />
        <p>{{ t('home.heroKicker') }}</p>
        <h1>{{ pickText(activeCarouselMv.title, localeStore.locale) }}</h1>
        <p v-if="activeCarouselMv.albumName" class="home-hero-carousel-album">{{ activeCarouselMv.albumName }}</p>
        <div class="home-hero-actions">
          <n-button type="primary" size="large" :loading="playingHero" @click="playHeroTrack(activeCarouselMv.trackId)">{{ t('home.playHero') }}</n-button>
          <n-button class="home-hero-secondary-button" size="large" @click="openCarouselMvPlayer(activeCarouselMv)">{{ t('home.watchMv') }}</n-button>
        </div>
      </div>
      <button v-if="featuredMvs.length > 1" class="home-hero-carousel-arrow home-hero-carousel-arrow--left" type="button" :aria-label="t('home.carouselPrev')" @click="carouselPrev">&#8249;</button>
      <button v-if="featuredMvs.length > 1" class="home-hero-carousel-arrow home-hero-carousel-arrow--right" type="button" :aria-label="t('home.carouselNext')" @click="carouselNext">&#8250;</button>
      <div v-if="featuredMvs.length > 1" class="home-hero-carousel-dots">
        <button
          v-for="(mv, idx) in featuredMvs"
          :key="mv.trackId"
          class="home-hero-carousel-dot"
          :class="{ 'is-active': idx === carouselIndex }"
          :aria-label="`Slide ${idx + 1}`"
          @click="goToSlide(idx)"
        />
      </div>
    </section>

    <!-- 无精选 MV 时回退到单视频 Hero -->
    <section v-else class="home-hero" :class="{ 'is-playing-mv': isHeroMvPlaying }" :style="{ '--hero-image': `url(${heroFallbackMv.cover})`, '--hero-aspect': heroFallbackMv.aspectRatio }">
      <div class="home-hero-image" aria-hidden="true" />
      <video
        v-if="!isMobile"
        ref="heroVideoRef"
        class="home-hero-video"
        :class="{ 'is-ready': heroVideoReady }"
        :poster="heroFallbackMv.cover"
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
        <source :src="heroFallbackMv.video" :type="heroFallbackMv.type" />
      </video>
      <video
        v-if="isHeroMvPlaying"
        ref="heroPlayerRef"
        class="home-hero-player"
        :poster="heroFallbackMv.cover"
        controls
        playsinline
        @ended="stopHeroPlayer"
      >
        <source :src="heroFallbackMv.video" :type="heroFallbackMv.type" />
      </video>
      <button v-if="isHeroMvPlaying" class="home-hero-player-close" type="button" :aria-label="t('mv.close')" @click="stopHeroPlayer">&#215;</button>
      <div class="home-hero-shade" />
      <div class="home-hero-content">
        <img class="home-hero-logo" src="/twice-logomark.png" alt="TWICE" width="118" height="118" decoding="async" fetchpriority="high" />
        <p>{{ t('home.heroKicker') }}</p>
        <h1>{{ heroFallbackMv.title }}</h1>
        <div class="home-hero-actions">
          <n-button type="primary" size="large" :loading="playingHero" @click="playHeroTrack(heroFallbackMv.trackId)">{{ t('home.playHero') }}</n-button>
          <n-button v-if="!isHeroMvPlaying" class="home-hero-secondary-button" size="large" @click="openHeroPlayer">{{ t('home.watchMv') }}</n-button>
          <n-button class="home-hero-secondary-button" size="large" secondary @click="$router.push('/albums')">{{ t('home.browseAlbums') }}</n-button>
        </div>
      </div>
    </section>

    <!-- MvPlayer modal -->
    <MvPlayer :show="mvPlayerShow" :title="mvPlayerTitle" :track-id="mvPlayerTrackId" :bili-bvid="mvPlayerBiliBvid" :bili-page="mvPlayerBiliPage" @update:show="mvPlayerShow = $event" />

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
          <span class="section-toggle-icon" :class="{ 'is-open': !isTimelineCollapsed }">&#8996;</span>
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
          <span class="section-toggle-icon" :class="{ 'is-open': !isAlbumsCollapsed }">&#8996;</span>
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
import MvPlayer from '@/components/player/MvPlayer.vue'
import { api } from '@/api/client'
import type { CatalogOverview, HomeFeaturedMv, Track } from '@/api/types'
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
const isMobile = ref(detectMobile())

// ---- Carousel state ----
const featuredMvs = ref<HomeFeaturedMv[]>([])
const carouselIndex = ref(0)
let carouselTimer: ReturnType<typeof setInterval> | null = null
const CAROUSEL_INTERVAL_MS = 5000

// ---- MvPlayer modal state ----
const mvPlayerShow = ref(false)
const mvPlayerTitle = ref('')
const mvPlayerTrackId = ref<string | null>(null)
const mvPlayerBiliBvid = ref<string | null>(null)
const mvPlayerBiliPage = ref<number | null>(null)

// ---- Fallback hero (no featured MVs) ----
const heroFallbackCover = 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg'
const heroFallbackMv = {
  title: 'ME+YOU',
  trackId: 'apple-twice-1840284140',
  cover: heroFallbackCover,
  video: import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4',
  aspectRatio: '16 / 9',
  type: (import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4').endsWith('.webm') ? 'video/webm' as const : 'video/mp4' as const,
}

// ---- Cover proxy helper (for B站 hdslb.com URLs) ----
const apiBase = import.meta.env.VITE_API_BASE || '/api'

function coverProxyUrl(raw: string | null) {
  if (!raw) return null
  const url = raw.replace(/^http:\/\//i, 'https://')
  try {
    const parsed = new URL(url)
    if (parsed.hostname.endsWith('.hdslb.com') || parsed.hostname === 'hdslb.com') {
      return `${apiBase}/mv/cover-proxy?url=${encodeURIComponent(url)}`
    }
  } catch { /* passthrough */ }
  return url
}

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

// ---- Carousel logic ----

// crossfade: prev cover stays visible briefly while next fades in
const carouselPrevIndex = ref(-1)
let carouselFadeTimer: ReturnType<typeof setTimeout> | null = null

const activeCarouselMv = computed(() => featuredMvs.value[carouselIndex.value] || { trackId: '', title: { zh: '', en: '' }, albumName: null } as HomeFeaturedMv)

const carouselCovers = computed(() => {
  const current = activeCarouselMv.value
  const prevMv = carouselPrevIndex.value >= 0 ? featuredMvs.value[carouselPrevIndex.value] : null
  return {
    current: coverProxyUrl(current.coverUrl) || heroFallbackCover,
    next: prevMv ? (coverProxyUrl(prevMv.coverUrl) || heroFallbackCover) : '',
    nextVisible: prevMv != null,
  }
})

function transitionToSlide(idx: number) {
  if (idx === carouselIndex.value) return
  // start crossfade: the current slide becomes "prev" layer
  carouselPrevIndex.value = carouselIndex.value
  carouselIndex.value = idx
  // after fade-in completes, hide the prev layer
  if (carouselFadeTimer != null) clearTimeout(carouselFadeTimer)
  carouselFadeTimer = setTimeout(() => {
    carouselPrevIndex.value = -1
    carouselFadeTimer = null
  }, 600)
}

function startCarousel() {
  stopCarousel()
  if (featuredMvs.value.length <= 1) return
  carouselTimer = setInterval(() => {
    transitionToSlide((carouselIndex.value + 1) % featuredMvs.value.length)
  }, CAROUSEL_INTERVAL_MS)
}

function stopCarousel() {
  if (carouselTimer != null) {
    clearInterval(carouselTimer)
    carouselTimer = null
  }
  if (carouselFadeTimer != null) {
    clearTimeout(carouselFadeTimer)
    carouselFadeTimer = null
    carouselPrevIndex.value = -1
  }
}

function pauseCarousel() {
  stopCarousel()
}

function resumeCarousel() {
  if (featuredMvs.value.length > 1) startCarousel()
}

function carouselPrev() {
  const len = featuredMvs.value.length
  transitionToSlide((carouselIndex.value - 1 + len) % len)
  resetCarouselTimer()
}

function carouselNext() {
  transitionToSlide((carouselIndex.value + 1) % featuredMvs.value.length)
  resetCarouselTimer()
}

function goToSlide(idx: number) {
  transitionToSlide(idx)
  resetCarouselTimer()
}

function resetCarouselTimer() {
  stopCarousel()
  startCarousel()
}

function openCarouselMvPlayer(mv: HomeFeaturedMv) {
  mvPlayerTitle.value = pickText(mv.title, localeStore.locale)
  mvPlayerTrackId.value = mv.trackId
  mvPlayerBiliBvid.value = mv.biliBvid
  mvPlayerBiliPage.value = mv.biliPage
  mvPlayerShow.value = true
}

// ---- Fallback hero logic ----

onMounted(() => {
  updateResponsiveState()
  window.addEventListener('resize', updateResponsiveState)
  void catalog.loadOverview()
  void loadFeaturedMvs()
  if (!isMobile.value) {
    void warmHeroTrack()
    void startHeroVideo()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateResponsiveState)
  stopCarousel()
})

async function loadFeaturedMvs() {
  try {
    const result = await api.homeFeaturedMvs()
    featuredMvs.value = result.mvs.filter((mv) => mv.enabled)
    if (featuredMvs.value.length > 1) startCarousel()
  } catch {
    featuredMvs.value = []
  }
}

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

async function playHeroTrack(trackId: string) {
  playingHero.value = true
  try {
    const track = heroTrack.value?.id === trackId ? heroTrack.value : (await api.track(trackId)).track
    heroTrack.value = track
    await audioStore.playTrack(track)
  } finally {
    playingHero.value = false
  }
}

async function warmHeroTrack() {
  try {
    const trackId = heroFallbackMv.trackId
    heroTrack.value = (await api.track(trackId)).track
    await audioStore.prefetchTrack(heroTrack.value)
  } catch {
    // The hero stays usable even if music warmup fails.
  }
}
</script>
