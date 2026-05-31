<template>
  <n-layout class="app-shell">
    <div class="site-background" aria-hidden="true" :style="{ '--site-bg-image': `url(${siteBackgroundImage})` }">
      <div class="site-background-image" />
      <video
        v-if="!isMobile"
        ref="siteVideoRef"
        class="site-background-video"
        :class="{ 'is-ready': siteVideoReady }"
        :poster="siteBackgroundImage"
        autoplay
        muted
        loop
        playsinline
        preload="none"
        @canplay="siteVideoReady = true"
        @loadeddata="siteVideoReady = true"
        @playing="siteVideoReady = true"
        @error="siteVideoReady = false"
      >
        <source :src="siteBackgroundVideo" :type="siteBackgroundVideoType" />
      </video>
      <div class="site-background-shade" />
    </div>

    <n-layout-header bordered class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark"><img src="/twice-logomark.png" alt="TWICE" width="66" height="66" decoding="async" /></span>
        <span>
          <strong>TWICE Discography</strong>
          <small>按年份浏览专辑与音乐</small>
        </span>
      </RouterLink>

      <nav class="nav-links">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/albums">专辑</RouterLink>
        <RouterLink to="/solo-unit">单人 / 小分队</RouterLink>
        <RouterLink to="/variety">综艺</RouterLink>
        <RouterLink to="/cfs">广告曲</RouterLink>
        <RouterLink to="/covers">翻唱</RouterLink>
        <RouterLink to="/members">成员</RouterLink>
      </nav>

      <div class="topbar-actions">
        <form class="topbar-search-form" @submit.prevent="runGlobalSearch">
          <n-input-group class="topbar-search">
            <n-input
              v-model:value="searchQuery"
              size="small"
              clearable
              placeholder="搜索歌曲 / 专辑 / 成员"
              @keydown.enter.prevent="runGlobalSearch"
            />
            <n-button attr-type="submit" size="small" type="primary" :loading="searchLoading">搜索</n-button>
          </n-input-group>
        </form>
        <span v-if="searchHint" class="topbar-search-hint">{{ searchHint }}</span>
        <n-button class="theme-toggle" circle secondary :aria-label="themeStore.isDark ? '切换浅色模式' : '切换深色模式'" @click="themeStore.toggleTheme">
          {{ themeStore.isDark ? '☀' : '☾' }}
        </n-button>
        <n-select
          class="locale-select"
          size="small"
          :value="localeStore.locale"
          :options="localeOptions"
          @update:value="localeStore.switchLocale"
        />
      </div>
    </n-layout-header>

    <n-layout-content class="content">
      <RouterView />
    </n-layout-content>

    <n-layout-footer bordered class="site-footer">
      <span>© 2026 t479842598. All rights reserved.</span>
      <a href="https://github.com/t479842598" target="_blank" rel="noreferrer">GitHub: t479842598</a>
      <span>TWICE 相关名称、商标与媒体版权归原权利方所有。</span>
    </n-layout-footer>

    <MiniAudioBar />
  </n-layout>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { api } from '@/api/client'
import type { Album, CfSong, Cover, Member, Track } from '@/api/types'
import MiniAudioBar from '@/components/player/MiniAudioBar.vue'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()
const router = useRouter()
const siteVideoReady = ref(false)
const siteVideoRef = ref<HTMLVideoElement | null>(null)
const searchQuery = ref('')
const searchLoading = ref(false)
const searchHint = ref('')
const isMobile = ref(detectMobile())
const siteBackgroundImage = 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg'
const siteBackgroundVideo = import.meta.env.VITE_SITE_BG_VIDEO || import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4'
const siteBackgroundVideoType = siteBackgroundVideo.endsWith('.webm') ? 'video/webm' : 'video/mp4'
const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '日本語', value: 'ja-JP' },
  { label: '한국어', value: 'ko-KR' },
]

onMounted(async () => {
  isMobile.value = detectMobile()
  if (isMobile.value) return

  await nextTick()
  if (!siteVideoRef.value) return
  if (siteVideoRef.value.readyState >= 2) {
    siteVideoReady.value = true
  }
  void siteVideoRef.value.play().catch(() => {
    siteVideoReady.value = siteVideoRef.value ? siteVideoRef.value.readyState >= 2 : false
  })
})

function detectMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth <= 820 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
}

type SearchResults = {
  albums: Album[]
  tracks: Track[]
  members: Member[]
  cfs: CfSong[]
  covers: Cover[]
}

function resultTarget(results: SearchResults, query: string) {
  const encodedQuery = query.trim()
  const normalizedQuery = encodedQuery.toLowerCase()
  const exactMember = results.members.find((member) =>
    [...Object.values(member.name), ...Object.values(member.realName)]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase() === normalizedQuery)
  )

  if (exactMember) {
    return {
      label: `成员：${pickText(exactMember.realName, localeStore.locale)}`,
      to: { name: 'member-detail', params: { id: exactMember.id }, query: { fromSearch: encodedQuery } },
    }
  }

  const exactTrack = results.tracks.find((track) =>
    Object.values(track.title)
      .filter(Boolean)
      .some((value) => String(value).toLowerCase() === normalizedQuery)
  )

  if (exactTrack || results.tracks[0]) {
    const track = exactTrack || results.tracks[0]
    return {
      label: `歌曲：${pickText(track.title, localeStore.locale)}`,
      to: { name: 'track-detail', params: { id: track.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.albums[0]) {
    const album = results.albums[0]
    return {
      label: `专辑：${pickText(album.title, localeStore.locale)}`,
      to: { name: 'album-detail', params: { id: album.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.members[0]) {
    const member = results.members[0]
    return {
      label: `成员：${pickText(member.realName, localeStore.locale)}`,
      to: { name: 'member-detail', params: { id: member.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.cfs[0]) {
    const cf = results.cfs[0]
    return {
      label: `广告曲：${pickText(cf.title, localeStore.locale)}`,
      to: { name: 'cfs', query: { highlight: cf.id, q: encodedQuery } },
    }
  }
  if (results.covers[0]) {
    const cover = results.covers[0]
    return {
      label: `翻唱：${cover.originalSong}`,
      to: { name: 'covers', query: { highlight: cover.id, q: encodedQuery } },
    }
  }
  return null
}

async function runGlobalSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchHint.value = '输入关键词后搜索'
    window.setTimeout(() => {
      searchHint.value = ''
    }, 1800)
    return
  }

  searchLoading.value = true
  try {
    const { results } = await api.search(query)
    const target = resultTarget(results, query)
    if (!target) {
      searchHint.value = '没有找到匹配内容'
      window.setTimeout(() => {
        searchHint.value = ''
      }, 2200)
      return
    }
    searchHint.value = `已跳转 ${target.label}`
    searchQuery.value = ''
    await router.push(target.to)
    window.setTimeout(() => {
      searchHint.value = ''
    }, 2600)
  } finally {
    searchLoading.value = false
  }
}
</script>
