<template>
  <main class="page music-station-page">
    <PageHeader :eyebrow="t('musicStation.eyebrow')" :title="t('musicStation.title')" :description="t('musicStation.description')" />

    <section class="music-station-panel">
      <form class="music-station-search" @submit.prevent="runSearch">
        <n-input-group>
          <n-input v-model:value="searchQuery" clearable :placeholder="t('musicStation.searchPlaceholder')" />
          <n-button attr-type="submit" type="primary" :loading="searchLoading">{{ t('musicStation.searchButton') }}</n-button>
        </n-input-group>
        <n-select v-model:value="selectedSources" multiple clearable :options="sourceOptions" :placeholder="t('musicStation.sourcePlaceholder')" />
        <n-select v-model:value="quality" :options="qualityOptions" />
      </form>

      <n-alert v-if="errorMessage" type="warning" closable @close="errorMessage = ''">
        {{ errorMessage }}
      </n-alert>

      <div v-if="currentResolved" class="music-station-player">
        <div>
          <span class="eyebrow">{{ t('musicStation.nowPlaying') }}</span>
          <h3>{{ currentResolved.selected.title }}</h3>
          <p>{{ currentResolved.selected.artist }}<template v-if="currentResolved.selected.album"> · {{ currentResolved.selected.album }}</template></p>
        </div>
        <audio ref="audioRef" class="music-station-audio" controls :src="currentResolved.audioUrl" autoplay @timeupdate="syncCurrentTime" @loadedmetadata="syncCurrentTime" @seeked="syncCurrentTime" />
        <n-button secondary type="primary" @click="openDownload(currentResolved.audioUrl)">{{ t('musicStation.download') }}</n-button>
      </div>

      <LyricsDisplay v-if="currentResolved?.lrc" :lrc="currentResolved.lrc" :current-time="currentTime" />
      <div v-else-if="currentResolved" class="music-station-lyrics-empty">{{ t('musicStation.noLyrics') }}</div>
    </section>

    <section class="section">
      <div class="section-heading-row">
        <h2>{{ t('musicStation.results') }}</h2>
        <span v-if="lastQuery" class="section-hint">{{ t('musicStation.resultCount', { count: results.length }) }}</span>
      </div>

      <n-spin :show="searchLoading">
        <n-empty v-if="hasSearched && !results.length" :description="t('musicStation.noResults')" />
        <div v-else class="music-result-grid">
          <n-card v-for="candidate in results" :key="candidateKey(candidate)" class="music-result-card" :class="{ 'is-active': currentKey === candidateKey(candidate) }">
            <div class="music-result-content">
              <img v-if="candidate.coverUrl" class="music-result-cover" :src="candidate.coverUrl" :alt="candidate.title" loading="lazy" />
              <div class="music-result-meta">
                <div class="music-result-title">{{ candidate.title || t('musicStation.unknownTitle') }}</div>
                <div class="music-result-subtitle">{{ candidate.artist || t('musicStation.unknownArtist') }}</div>
                <div v-if="candidate.album" class="music-result-album">{{ candidate.album }}</div>
                <n-space class="music-result-tags">
                  <n-tag size="small" :bordered="false">{{ candidate.sourceName }}</n-tag>
                  <n-tag v-if="candidate.durationSec" size="small" :bordered="false">{{ formatDuration(candidate.durationSec) }}</n-tag>
                  <n-tag size="small" :bordered="false">{{ qualityLabel(candidate) }}</n-tag>
                  <n-tag v-if="candidate.hasLyrics" size="small" type="success" :bordered="false">{{ t('musicStation.lyrics') }}</n-tag>
                </n-space>
              </div>
            </div>
            <template #action>
              <n-space justify="end">
                <n-button size="small" secondary :disabled="unavailableKeys.has(candidateKey(candidate))" :loading="resolvingKey === candidateKey(candidate) && resolveAction === 'play'" @click="playCandidate(candidate)">
                  {{ t('musicStation.play') }}
                </n-button>
                <n-button size="small" type="primary" secondary :disabled="unavailableKeys.has(candidateKey(candidate))" :loading="resolvingKey === candidateKey(candidate) && resolveAction === 'download'" @click="downloadCandidate(candidate)">
                  {{ t('musicStation.download') }}
                </n-button>
              </n-space>
            </template>
          </n-card>
        </div>
      </n-spin>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, ApiError } from '@/api/client'
import type { MusicCandidate, MusicResolveResponse } from '@/api/types'
import PageHeader from '@/components/common/PageHeader.vue'
import LyricsDisplay from '@/components/player/LyricsDisplay.vue'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const searchQuery = ref('')
const lastQuery = ref('')
const selectedSources = ref<string[]>([])
const quality = ref('best')
const results = ref<MusicCandidate[]>([])
const currentResolved = ref<MusicResolveResponse | null>(null)
const audioRef = ref<HTMLAudioElement | null>(null)
const currentTime = ref(0)
const searchLoading = ref(false)
const resolvingKey = ref('')
const resolveAction = ref<'play' | 'download' | ''>('')
const errorMessage = ref('')
const hasSearched = ref(false)
const resolveCache = new Map<string, MusicResolveResponse>()
const unavailableKeys = ref(new Set<string>())

const sourceOptions = computed(() => [
  { label: t('musicStation.source.qq'), value: 'qq' },
  { label: t('musicStation.source.netease'), value: 'netease' },
  { label: t('musicStation.source.kuwo'), value: 'kuwo' },
  { label: t('musicStation.source.joox'), value: 'joox' },
])

const qualityOptions = computed(() => [
  { label: t('musicStation.quality.best'), value: 'best' },
  { label: t('musicStation.quality.lossless'), value: 'lossless' },
  { label: t('musicStation.quality.320k'), value: '320k' },
  { label: t('musicStation.quality.hq'), value: 'hq' },
  { label: t('musicStation.quality.standard'), value: 'standard' },
])

const currentKey = computed(() => currentResolved.value ? `${currentResolved.value.source}:${currentResolved.value.providerId}` : '')

function candidateKey(candidate: MusicCandidate) {
  return `${candidate.source}:${candidate.providerId}`
}

function resolveCacheKey(candidate: MusicCandidate) {
  return `${lastQuery.value}:${candidateKey(candidate)}:${quality.value}`
}

function formatDuration(durationSec: number) {
  const minutes = Math.floor(durationSec / 60)
  const seconds = String(Math.floor(durationSec % 60)).padStart(2, '0')
  return `${minutes}:${seconds}`
}

function qualityLabel(candidate: MusicCandidate) {
  return candidate.quality.tag === 'unknown' ? t('musicStation.quality.pending') : candidate.quality.label
}

function friendlyError(error: unknown) {
  return error instanceof ApiError && error.status === 404 ? t('musicStation.unavailableExact') : t('musicStation.error')
}

async function runSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    errorMessage.value = t('musicStation.emptyQuery')
    return
  }

  searchLoading.value = true
  errorMessage.value = ''
  hasSearched.value = true

  try {
    const response = await api.musicSearch({ q: query, sources: selectedSources.value, limit: 20 })
    lastQuery.value = response.query
    results.value = response.results
    unavailableKeys.value = new Set()
  } catch (error) {
    errorMessage.value = friendlyError(error)
    results.value = []
  } finally {
    searchLoading.value = false
  }
}

async function resolveCandidate(candidate: MusicCandidate, action: 'play' | 'download') {
  if (!lastQuery.value) return null

  const key = resolveCacheKey(candidate)
  const cached = resolveCache.get(key)
  if (cached) return cached

  resolvingKey.value = candidateKey(candidate)
  resolveAction.value = action
  errorMessage.value = ''

  try {
    const response = await api.musicResolve({
      q: lastQuery.value,
      source: candidate.source,
      providerId: candidate.providerId,
      quality: quality.value,
    })
    resolveCache.set(key, response)
    return response
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      unavailableKeys.value = new Set([...unavailableKeys.value, candidateKey(candidate)])
      errorMessage.value = t('musicStation.unavailableExact')
    } else {
      errorMessage.value = friendlyError(error)
    }
    return null
  } finally {
    resolvingKey.value = ''
    resolveAction.value = ''
  }
}

async function playCandidate(candidate: MusicCandidate) {
  const response = await resolveCandidate(candidate, 'play')
  if (response) {
    currentTime.value = 0
    currentResolved.value = response
  }
}

function openDownload(audioUrl: string) {
  window.open(audioUrl, '_blank', 'noopener,noreferrer')
}

function syncCurrentTime() {
  currentTime.value = audioRef.value?.currentTime ?? 0
}

async function downloadCandidate(candidate: MusicCandidate) {
  const response = await resolveCandidate(candidate, 'download')
  if (response?.audioUrl) openDownload(response.audioUrl)
}
</script>

<style scoped>
.music-station-page {
  gap: 28px;
}

.music-station-panel,
.music-station-player,
.music-result-card {
  border: 1px solid var(--soft-border);
  background: var(--panel-bg);
  backdrop-filter: blur(18px);
}

.music-station-panel {
  display: grid;
  gap: 18px;
  padding: 20px;
  border-radius: 28px;
  box-shadow: var(--shadow-soft);
}

.music-station-search {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(180px, 260px) minmax(150px, 200px);
  gap: 12px;
  align-items: center;
}

.music-station-player {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(260px, 520px) auto;
  gap: 16px;
  align-items: center;
  padding: 16px;
  border-radius: 22px;
}

.music-station-player h3,
.music-station-player p {
  margin: 0;
}

.music-station-player h3 {
  color: var(--heading-text);
}

.music-station-player p,
.section-hint,
.music-result-subtitle,
.music-result-album {
  color: var(--muted-text);
}

.music-station-audio {
  width: 100%;
}

.music-station-lyrics-empty {
  padding: 14px 18px;
  border: 1px dashed var(--soft-border);
  border-radius: 18px;
  color: var(--muted-text);
  text-align: center;
}

.section-heading-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.music-result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.music-result-card {
  border-radius: 22px;
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}

.music-result-card:hover,
.music-result-card.is-active {
  transform: translateY(-3px);
  border-color: rgba(255, 107, 157, 0.42);
  box-shadow: 0 14px 28px rgba(255, 107, 157, 0.16);
}

.music-result-content {
  display: flex;
  gap: 14px;
  min-width: 0;
}

.music-result-cover {
  width: 70px;
  height: 70px;
  flex: 0 0 auto;
  border-radius: 18px;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.08);
}

.music-result-meta {
  min-width: 0;
}

.music-result-title {
  overflow: hidden;
  color: var(--heading-text);
  font-size: 16px;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-result-subtitle,
.music-result-album {
  overflow: hidden;
  margin-top: 4px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.music-result-tags {
  margin-top: 10px;
}

.music-result-card :deep(.n-card__content) {
  padding: 18px;
}

.music-result-card :deep(.n-card__action) {
  padding: 12px 18px;
  background: rgba(255, 107, 157, 0.08);
}

@media (max-width: 900px) {
  .music-station-search,
  .music-station-player {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .music-station-page {
    gap: 18px;
  }

  .music-station-panel {
    gap: 12px;
    padding: 14px;
    border-radius: 22px;
  }

  .music-station-search {
    gap: 10px;
  }

  .music-station-player {
    gap: 12px;
    padding: 14px;
    border-radius: 18px;
  }

  .music-station-player h3 {
    font-size: 18px;
  }

  .section-heading-row {
    margin-bottom: 12px;
  }

  .music-result-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .music-result-card {
    overflow: hidden;
    border-radius: 22px;
  }

  .music-result-card:hover,
  .music-result-card.is-active {
    transform: none;
  }

  .music-result-card :deep(.n-card__content) {
    padding: 16px;
  }

  .music-result-card :deep(.n-card__action) {
    padding: 10px 16px;
  }

  .music-result-card :deep(.n-card__action .n-space) {
    justify-content: flex-end !important;
  }

  .music-result-content {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    min-height: 96px;
  }

  .music-result-content:not(:has(.music-result-cover)) {
    display: block;
    min-height: 76px;
  }

  .music-result-cover {
    width: 88px;
    height: 88px;
    border-radius: 20px;
  }

  .music-result-title {
    font-size: 17px;
    line-height: 1.3;
    white-space: normal;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .music-result-subtitle,
  .music-result-album {
    font-size: 14px;
  }

  .music-result-tags {
    margin-top: 8px;
  }
}
</style>
