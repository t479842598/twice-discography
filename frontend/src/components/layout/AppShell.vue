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
          <strong>{{ t('brand.title') }}</strong>
          <small>{{ t('brand.subtitle') }}</small>
        </span>
      </RouterLink>

      <nav class="nav-links">
        <RouterLink to="/">{{ t('nav.home') }}</RouterLink>
        <RouterLink to="/albums">{{ t('nav.albums') }}</RouterLink>
        <RouterLink to="/solo-unit">{{ t('nav.soloUnit') }}</RouterLink>
        <RouterLink to="/cfs">{{ t('nav.cfs') }}</RouterLink>
        <RouterLink to="/covers">{{ t('nav.covers') }}</RouterLink>
        <RouterLink to="/members">{{ t('nav.members') }}</RouterLink>
        <RouterLink to="/music-station">{{ t('nav.musicStation') }}</RouterLink>
      </nav>

      <div class="topbar-actions">
        <form class="topbar-search-form" @submit.prevent="runGlobalSearch">
          <n-input-group class="topbar-search">
            <n-input
              v-model:value="searchQuery"
              size="small"
              clearable
              :placeholder="t('search.placeholder')"
              @keydown.enter.prevent="runGlobalSearch"
            />
            <n-button attr-type="submit" size="small" type="primary" :loading="searchLoading">{{ t('search.button') }}</n-button>
          </n-input-group>
        </form>
        <span v-if="searchHint" class="topbar-search-hint">{{ searchHint }}</span>
        <n-button class="theme-toggle" circle secondary :aria-label="themeStore.isDark ? t('theme.toLight') : t('theme.toDark')" @click="themeStore.toggleTheme">
          {{ themeStore.isDark ? '☀' : '☾' }}
        </n-button>
        <n-dropdown trigger="click" :options="localeDropdownOptions" @select="handleLocaleSelect">
          <n-button class="locale-toggle" circle secondary :title="`${t('language.aria')}: ${localeStore.label}`" :aria-label="t('language.aria')">
            <svg class="locale-toggle-icon" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
              <path d="M864 64a96 96 0 0 1 96 96v704a96 96 0 0 1-96 96H160a96 96 0 0 1-96-96V160a96 96 0 0 1 96-96h704z m0 64H160a32 32 0 0 0-32 32v704a32 32 0 0 0 32 32h704a32 32 0 0 0 32-32V160a32 32 0 0 0-32-32z m-322.4 256c0-31.456 40.64-44.032 58.4-18.08l133.6 195.168V384a32 32 0 0 1 64 0v280.48c0 31.456-40.64 44.032-58.4 18.08l-133.6-195.168v177.088a32 32 0 1 1-64 0z" fill="currentColor" />
              <path d="M448 352a32 32 0 0 1 0 64H288v80h160a32 32 0 0 1 31.776 28.256L480 528a32 32 0 0 1-32 32H288v72.48h160a32 32 0 1 1 0 64H256a32 32 0 0 1-32-32V384a32 32 0 0 1 32-32z" fill="#FAAC08" />
            </svg>
          </n-button>
        </n-dropdown>
        <div class="admin-auth-slot">
          <RouterLink v-if="!adminLoggedIn" class="admin-login-link" to="/admin/login">登录</RouterLink>
          <n-dropdown v-else trigger="click" :options="adminAccountMenuOptions" @select="handleAdminAccountSelect">
            <button class="admin-account-button" type="button" :title="`已登录：${adminDisplayName}`">
              <span class="admin-account-avatar">{{ adminInitial }}</span>
              <span class="admin-account-name">{{ adminDisplayName }}</span>
              <span class="admin-account-caret" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
          </n-dropdown>
        </div>
      </div>
    </n-layout-header>

    <n-layout-content class="content">
      <RouterView />
    </n-layout-content>

    <n-layout-footer bordered class="site-footer">
      <span>© 2026 t479842598. All rights reserved.</span>
      <a href="https://github.com/t479842598" target="_blank" rel="noreferrer">GitHub: t479842598</a>
      <span>{{ t('footer.disclaimer') }}</span>
    </n-layout-footer>

    <MiniAudioBar />
  </n-layout>
</template>

<script setup lang="ts">
import type { DropdownOption } from 'naive-ui'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { api } from '@/api/client'
import type { AdminUser, Album, CfSong, Cover, Member, Track } from '@/api/types'
import MiniAudioBar from '@/components/player/MiniAudioBar.vue'
import { useI18n } from '@/i18n'
import { isLocaleCode } from '@/i18n/messages'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'
import { pickText } from '@/utils/text'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()
const router = useRouter()
const route = useRoute()
const { localeLabels, supportedLocales, t } = useI18n()
const siteVideoReady = ref(false)
const siteVideoRef = ref<HTMLVideoElement | null>(null)
const searchQuery = ref('')
const searchLoading = ref(false)
const searchHint = ref('')
const adminUser = ref<AdminUser | null>(null)
const isMobile = ref(detectMobile())
const siteBackgroundImage = 'https://d1al7qj7ydfbpt.cloudfront.net/artist/twice/2ecb5a255d824a90a1f1d366c1333813-%E1%84%8A%E1%85%A5%E1%86%B7%E1%84%82%E1%85%A6%E1%84%8B%E1%85%B5%E1%86%AF.jpg'
const siteBackgroundVideo = import.meta.env.VITE_SITE_BG_VIDEO || import.meta.env.VITE_HOME_BG_VIDEO || '/media/me-you-bg.mp4'
const siteBackgroundVideoType = siteBackgroundVideo.endsWith('.webm') ? 'video/webm' : 'video/mp4'
const localeDropdownOptions = computed(() => supportedLocales.map((locale) => ({
  key: locale,
  label: localeLabels[locale],
})))
const adminLoggedIn = computed(() => Boolean(adminUser.value))
const adminDisplayName = computed(() => adminUser.value?.displayName || adminUser.value?.email || 'Admin')
const adminInitial = computed(() => adminDisplayName.value.trim().slice(0, 1).toUpperCase() || 'A')
const adminAccountMenuOptions = computed<DropdownOption[]>(() => {
  const canManageUsers = adminUser.value?.roles.includes('owner')
  return [
    { key: 'admin-summary', label: `当前账号：${adminDisplayName.value}`, disabled: true },
    { key: 'admin', label: '管理后台' },
    { key: 'admin-mvs', label: 'MV 管理' },
    { key: 'admin-bili', label: 'B站凭证' },
    ...(canManageUsers ? [{ key: 'admin-users', label: '用户与角色' } as DropdownOption] : []),
    { key: 'logout', label: '退出登录' },
  ]
})

onMounted(async () => {
  isMobile.value = detectMobile()
  void refreshAdminState()
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

async function refreshAdminState() {
  try {
    adminUser.value = (await api.adminMe()).user
  } catch {
    adminUser.value = null
  }
}

async function logoutAdmin() {
  await api.adminLogout().catch(() => undefined)
  adminUser.value = null
  if (route.path.startsWith('/admin')) {
    await router.push('/admin/login')
  }
}

function handleAdminAccountSelect(key: string | number) {
  const selected = String(key)
  if (selected === 'logout') {
    void logoutAdmin()
    return
  }

  const targets: Record<string, string> = {
    admin: '/admin',
    'admin-mvs': '/admin/mvs',
    'admin-bili': '/admin/settings/bilibili',
    'admin-users': '/admin/users',
  }
  const target = targets[selected]
  if (target) void router.push(target)
}

watch(
  () => route.fullPath,
  () => {
    void refreshAdminState()
  },
)

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
      label: t('search.result.member', { value: pickText(exactMember.realName, localeStore.locale) }),
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
      label: t('search.result.track', { value: pickText(track.title, localeStore.locale) }),
      to: { name: 'track-detail', params: { id: track.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.albums[0]) {
    const album = results.albums[0]
    return {
      label: t('search.result.album', { value: pickText(album.title, localeStore.locale) }),
      to: { name: 'album-detail', params: { id: album.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.members[0]) {
    const member = results.members[0]
    return {
      label: t('search.result.member', { value: pickText(member.realName, localeStore.locale) }),
      to: { name: 'member-detail', params: { id: member.id }, query: { fromSearch: encodedQuery } },
    }
  }
  if (results.cfs[0]) {
    const cf = results.cfs[0]
    return {
      label: t('search.result.cf', { value: pickText(cf.title, localeStore.locale) }),
      to: { name: 'cfs', query: { highlight: cf.id, q: encodedQuery } },
    }
  }
  if (results.covers[0]) {
    const cover = results.covers[0]
    return {
      label: t('search.result.cover', { value: cover.originalSong }),
      to: { name: 'covers', query: { highlight: cover.id, q: encodedQuery } },
    }
  }
  return null
}

async function runGlobalSearch() {
  const query = searchQuery.value.trim()
  if (!query) {
    searchHint.value = t('search.emptyInput')
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
      searchHint.value = t('search.noResult')
      window.setTimeout(() => {
        searchHint.value = ''
      }, 2200)
      return
    }
    searchHint.value = t('search.redirected', { target: target.label })
    searchQuery.value = ''
    await router.push(target.to)
    window.setTimeout(() => {
      searchHint.value = ''
    }, 2600)
  } finally {
    searchLoading.value = false
  }
}

function handleLocaleSelect(key: string | number) {
  const next = String(key)
  if (isLocaleCode(next)) localeStore.switchLocale(next)
}
</script>
