<template>
  <n-layout class="app-shell">
    <n-layout-header bordered class="topbar">
      <RouterLink to="/" class="brand">
        <span class="brand-mark"><img src="/twice-logomark.png" alt="TWICE" /></span>
        <span>
          <strong>TWICE Discography</strong>
          <small>按年份浏览专辑与音乐</small>
        </span>
      </RouterLink>

      <nav class="nav-links">
        <RouterLink to="/">首页</RouterLink>
        <RouterLink to="/albums">专辑</RouterLink>
        <RouterLink to="/solo-unit">单人 / 小分队</RouterLink>
        <RouterLink to="/cfs">广告曲</RouterLink>
        <RouterLink to="/covers">翻唱</RouterLink>
        <RouterLink to="/members">成员</RouterLink>
        <RouterLink to="/search">搜索</RouterLink>
      </nav>

      <div class="topbar-actions">
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

    <MiniAudioBar />
  </n-layout>
</template>

<script setup lang="ts">
import { RouterLink, RouterView } from 'vue-router'
import MiniAudioBar from '@/components/player/MiniAudioBar.vue'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()
const localeOptions = [
  { label: '中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
  { label: '日本語', value: 'ja-JP' },
  { label: '한국어', value: 'ko-KR' },
]
</script>
