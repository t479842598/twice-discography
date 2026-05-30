<template>
  <n-config-provider :theme="themeStore.isDark ? darkTheme : null" :theme-overrides="themeOverrides">
    <n-message-provider>
      <n-dialog-provider>
        <n-loading-bar-provider>
          <AppShell />
        </n-loading-bar-provider>
      </n-dialog-provider>
    </n-message-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'
import { onMounted } from 'vue'
import AppShell from '@/components/layout/AppShell.vue'
import { useLocaleStore } from '@/stores/locale'
import { useThemeStore } from '@/stores/theme'

const localeStore = useLocaleStore()
const themeStore = useThemeStore()

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#df6f86',
    primaryColorHover: '#c95f76',
    primaryColorPressed: '#a94f64',
    primaryColorSuppl: '#f3a8b7',
    borderRadius: '8px',
    fontFamily: 'Outfit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
}

onMounted(() => {
  void localeStore.init()
})
</script>
