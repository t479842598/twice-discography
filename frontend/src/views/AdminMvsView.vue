<template>
  <main class="page admin-page">
    <section class="page-header">
      <div>
        <span class="eyebrow">Admin</span>
        <h1>MV 管理</h1>
        <p>维护歌曲对应的 B站视频、封面和首页滚动展示。</p>
      </div>
      <RouterLink class="section-toggle" to="/admin">返回后台</RouterLink>
    </section>

    <section class="panel admin-panel">
      <div class="admin-mv-toolbar">
        <n-input v-model:value="query" clearable placeholder="搜索歌曲、BVID 或 trackId" @keydown.enter.prevent="searchMvs" />
        <n-switch v-model:value="titleOnly" @update:value="searchMvs"><template #checked>只看主打曲</template><template #unchecked>全部歌曲</template></n-switch>
        <n-switch v-model:value="onlyWithMv" @update:value="searchMvs"><template #checked>只看已配置</template><template #unchecked>全部配置状态</template></n-switch>
        <n-button type="primary" :loading="loading" @click="searchMvs">查询</n-button>
        <n-button type="primary" secondary :loading="savingAll" @click="saveCurrentPage">保存本页</n-button>
      </div>

      <div class="admin-table admin-mv-table">
        <div class="admin-table-row admin-table-head admin-mv-table-row">
          <span>歌曲</span>
          <span>搜索</span>
          <span>B站链接 / BVID</span>
          <span>P</span>
          <span>封面</span>
          <span>首页</span>
          <span>启用</span>
          <span>操作</span>
        </div>
        <div v-for="mv in mvs" :key="mv.trackId" class="admin-table-row admin-mv-table-row">
          <div class="admin-mv-title">
            <strong>{{ mv.titleZh || mv.titleEn || mv.trackId }}</strong>
            <small>{{ mv.trackId }} · {{ mv.albumName || '无专辑' }}</small>
          </div>
          <div class="admin-mv-search-cell">
            <n-button size="small" secondary tag="a" :href="biliSearchUrl(mv)" target="_blank" rel="noopener noreferrer">B站搜索</n-button>
          </div>
          <div class="admin-mv-link-cell">
            <n-input v-model:value="linkInputs[mv.trackId]" size="small" placeholder="粘贴 B站链接自动解析" @keydown.enter.prevent="parseBiliLink(mv)" />
            <n-input v-model:value="mv.biliBvid" size="small" placeholder="BVID" />
          </div>
          <n-input-number v-model:value="mv.biliPage" size="small" :min="1" placeholder="P" />
          <div class="admin-mv-cover-cell">
            <img v-if="mv.coverUrl" :src="coverPreviewUrl(mv.coverUrl)" alt="" loading="lazy" decoding="async" />
            <n-input v-model:value="mv.coverUrl" size="small" placeholder="封面 URL" />
          </div>
          <n-switch v-model:value="mv.isHomeFeatured" size="small" />
          <n-switch v-model:value="mv.enabled" size="small" />
          <div class="admin-inline-actions">
            <n-button size="small" secondary :loading="parsingTrackId === mv.trackId" @click="parseBiliLink(mv)">解析</n-button>
            
          </div>
        </div>
      </div>

      <div class="admin-pagination-row">
        <span>共 {{ total }} 条</span>
        <n-pagination v-model:page="page" :page-size="pageSize" :item-count="total" :page-slot="6" @update:page="loadMvs" />
        <n-select v-model:value="pageSize" class="admin-page-size" :options="pageSizeOptions" @update:value="changePageSize" />
      </div>
      <p v-if="message" class="admin-message">{{ message }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { api } from '@/api/client'
import type { AdminMvConfig } from '@/api/types'

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
const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '50 条/页', value: 50 },
]

async function loadMvs() {
  loading.value = true
  message.value = ''
  try {
    const result = await api.adminMvs({ q: query.value, page: page.value, pageSize: pageSize.value, onlyWithMv: onlyWithMv.value, titleOnly: titleOnly.value })
    mvs.value = result.mvs
    total.value = result.total
    page.value = result.page
    pageSize.value = result.pageSize
  } catch (error) {
    message.value = error instanceof Error ? error.message : '加载失败'
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
    message.value = '请先粘贴 B站链接或填写 BVID'
    return
  }
  parsingTrackId.value = mv.trackId
  message.value = ''
  try {
    const { meta } = await api.adminParseBiliMv(link)
    mv.biliBvid = meta.biliBvid
    mv.biliPage = meta.biliPage
    if (meta.coverUrl) mv.coverUrl = meta.coverUrl
    message.value = meta.title ? `已解析：${meta.title}` : `已解析 ${meta.biliBvid}`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '解析失败'
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
    message.value = `已保存本页 ${savedRows.length} 条`
  } catch (error) {
    message.value = error instanceof Error ? error.message : '保存失败'
  } finally {
    savingAll.value = false
  }
}

onMounted(loadMvs)
</script>
