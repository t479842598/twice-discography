<template>
  <section class="admin-module admin-mvs-module">
    <header class="admin-module-header">
      <div>
        <span class="admin-module-kicker">{{ t('admin.common.eyebrow') }}</span>
        <h1>{{ t('admin.mvs.title') }}</h1>
        <p>{{ t('admin.mvs.description') }}</p>
      </div>
      <div class="admin-module-summary">
        <span>{{ t('admin.mvs.total', { total }) }}</span>
      </div>
    </header>

    <section class="admin-panel">
      <div class="admin-toolbar admin-mv-toolbar">
        <n-input v-model:value="query" clearable :placeholder="t('admin.mvs.searchPlaceholder')" @keydown.enter.prevent="searchMvs">
          <template #prefix>
            <n-icon :component="SearchOutline" />
          </template>
        </n-input>
        <div class="admin-toolbar-switches">
          <n-switch v-model:value="titleOnly" @update:value="searchMvs">
            <template #checked>{{ t('admin.mvs.titleOnly') }}</template>
            <template #unchecked>{{ t('admin.mvs.allSongs') }}</template>
          </n-switch>
          <n-switch v-model:value="onlyWithMv" @update:value="searchMvs">
            <template #checked>{{ t('admin.mvs.configuredOnly') }}</template>
            <template #unchecked>{{ t('admin.mvs.allConfigStatus') }}</template>
          </n-switch>
        </div>
        <div class="admin-toolbar-actions">
          <n-button type="primary" :loading="loading" @click="searchMvs">
            <template #icon>
              <n-icon :component="SearchOutline" />
            </template>
            {{ t('admin.common.search') }}
          </n-button>
          <n-button type="primary" secondary :loading="savingAll" @click="saveCurrentPage">
            <template #icon>
              <n-icon :component="SaveOutline" />
            </template>
            {{ t('admin.mvs.savePage') }}
          </n-button>
        </div>
      </div>

      <div class="admin-card-list admin-mv-list">
        <article v-for="mv in mvs" :key="mv.trackId" class="admin-media-card">
          <div class="admin-media-cover">
            <img v-if="mv.coverUrl" :src="coverPreviewUrl(mv.coverUrl)" :alt="displayTitle(mv)" loading="lazy" decoding="async" />
            <span v-else class="admin-cover-placeholder" aria-hidden="true">
              <n-icon :component="ImageOutline" />
            </span>
          </div>

          <div class="admin-media-body">
            <div class="admin-media-head">
              <div class="admin-media-title">
                <strong>{{ displayTitle(mv) }}</strong>
                <small>{{ mv.trackId }} · {{ mv.albumName || t('admin.mvs.noAlbum') }}</small>
              </div>
              <div class="admin-media-switches">
                <label class="admin-media-switch">
                  <span>{{ t('admin.mvs.column.home') }}</span>
                  <n-switch v-model:value="mv.isHomeFeatured" size="small" />
                </label>
                <label class="admin-media-switch">
                  <span>{{ t('admin.mvs.column.enabled') }}</span>
                  <n-switch v-model:value="mv.enabled" size="small" />
                </label>
              </div>
            </div>

            <div class="admin-media-fields">
              <n-input v-model:value="linkInputs[mv.trackId]" size="small" :placeholder="t('admin.mvs.linkPlaceholder')" @keydown.enter.prevent="parseBiliLink(mv)">
                <template #prefix>
                  <n-icon :component="LinkOutline" />
                </template>
              </n-input>
              <n-input v-model:value="mv.biliBvid" size="small" :placeholder="t('admin.mvs.bvidPlaceholder')" />
              <n-input-number v-model:value="mv.biliPage" size="small" :min="1" :placeholder="t('admin.mvs.pagePlaceholder')" class="admin-media-page" />
              <n-input v-model:value="mv.coverUrl" size="small" :placeholder="t('admin.mvs.coverPlaceholder')" class="admin-media-cover-url" />
            </div>

            <div class="admin-media-actions">
              <n-button size="small" secondary tag="a" :href="biliSearchUrl(mv)" target="_blank" rel="noopener noreferrer">
                <template #icon>
                  <n-icon :component="OpenOutline" />
                </template>
                {{ t('admin.mvs.biliSearch') }}
              </n-button>
              <n-button size="small" secondary :loading="parsingTrackId === mv.trackId" @click="parseBiliLink(mv)">
                <template #icon>
                  <n-icon :component="RefreshOutline" />
                </template>
                {{ t('admin.mvs.parse') }}
              </n-button>
            </div>
          </div>
        </article>
      </div>

      <div class="admin-pagination-row">
        <span>{{ t('admin.mvs.total', { total }) }}</span>
        <n-pagination v-model:page="page" :page-size="pageSize" :item-count="total" :page-slot="6" @update:page="loadMvs" />
        <n-select v-model:value="pageSize" class="admin-page-size" :options="pageSizeOptions" @update:value="changePageSize" />
      </div>
      <p v-if="message" class="admin-message">{{ message }}</p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ImageOutline, LinkOutline, OpenOutline, RefreshOutline, SaveOutline, SearchOutline } from '@vicons/ionicons5'
import { api } from '@/api/client'
import type { AdminMvConfig } from '@/api/types'
import { useI18n } from '@/i18n'

const { t } = useI18n()
const query = ref('')
const titleOnly = ref(true)
const onlyWithMv = ref(false)
const loading = ref(false)
const message = ref('')
const mvs = ref<AdminMvConfig[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const parsingTrackId = ref('')
const savingAll = ref(false)
const apiBase = import.meta.env.VITE_API_BASE || '/api'
const linkInputs = reactive<Record<string, string>>({})
const pageSizeOptions = computed(() => [
  { label: t('admin.mvs.pageSize.10'), value: 10 },
  { label: t('admin.mvs.pageSize.20'), value: 20 },
  { label: t('admin.mvs.pageSize.50'), value: 50 },
])

async function loadMvs() {
  loading.value = true
  message.value = ''
  try {
    const result = await api.adminMvs({ q: query.value, page: page.value, pageSize: pageSize.value, onlyWithMv: onlyWithMv.value, titleOnly: titleOnly.value })
    mvs.value = result.mvs
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch {
    message.value = t('admin.common.loadingFailed')
  } finally {
    loading.value = false
  }
}

function searchMvs() {
  page.value = 1
  void loadMvs()
}

function changePageSize() {
  page.value = 1
  void loadMvs()
}

function displayTitle(mv: AdminMvConfig) {
  return mv.titleZh || mv.titleEn || mv.trackId
}

function httpsUrl(value: string) {
  return value.replace(/^http:\/\//i, 'https://')
}

function coverPreviewUrl(value: string) {
  return apiBase + '/mv/cover-proxy?url=' + encodeURIComponent(httpsUrl(value))
}

function artistKeyword(trackId: string) {
  if (trackId.includes('nayeon')) return 'NAYEON'
  if (trackId.includes('jihyo')) return 'JIHYO'
  if (trackId.includes('tzuyu')) return 'TZUYU'
  if (trackId.includes('misamo')) return 'MISAMO'
  return 'TWICE'
}

function biliSearchUrl(mv: AdminMvConfig) {
  const title = mv.titleEn || mv.titleZh || mv.trackId
  return `https://search.bilibili.com/all?keyword=${encodeURIComponent(`${artistKeyword(mv.trackId)} ${title} MV`)}`
}

async function parseBiliLink(mv: AdminMvConfig) {
  const link = linkInputs[mv.trackId]?.trim() || mv.biliBvid || mv.fallbackBiliBvid || ''
  if (!link) {
    message.value = t('admin.mvs.needLink')
    return
  }
  parsingTrackId.value = mv.trackId
  message.value = ''
  try {
    const { meta } = await api.adminParseBiliMv(link)
    mv.biliBvid = meta.biliBvid
    mv.biliPage = meta.biliPage
    if (meta.coverUrl) mv.coverUrl = meta.coverUrl
    message.value = meta.title ? t('admin.mvs.parsedTitle', { title: meta.title }) : t('admin.mvs.parsedBvid', { bvid: meta.biliBvid })
  } catch {
    message.value = t('admin.mvs.parseFailed')
  } finally {
    parsingTrackId.value = ''
  }
}

async function saveCurrentPage() {
  savingAll.value = true
  message.value = ''
  try {
    const savedRows = await Promise.all(mvs.value.map((mv) => api.adminSaveMv(mv)))
    for (const saved of savedRows) {
      const target = mvs.value.find((mv) => mv.trackId === saved.mv.trackId)
      if (target) Object.assign(target, saved.mv)
    }
    message.value = t('admin.mvs.savedPage', { count: savedRows.length })
  } catch {
    message.value = t('admin.common.saveFailed')
  } finally {
    savingAll.value = false
  }
}

onMounted(loadMvs)
</script>
