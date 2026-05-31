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
    primaryColor: '#ff6b9d',
    primaryColorHover: '#ff8cb3',
    primaryColorPressed: '#e91e63',
    primaryColorSuppl: '#ffb3d9',
    borderRadius: '12px',
    fontFamily: 'Outfit, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  Button: {
    borderRadiusLarge: '16px',
    borderRadiusMedium: '12px',
    fontWeightStrong: '700',
  },
  Card: {
    borderRadius: '18px',
  },
  Input: {
    borderRadius: '12px',
  },
}

onMounted(() => {
  void localeStore.init()
})
</script>
