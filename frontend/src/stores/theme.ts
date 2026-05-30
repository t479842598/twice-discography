import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

type ThemeMode = 'light' | 'dark'

const storageKey = 'theme-mode'

export const useThemeStore = defineStore('theme', () => {
  const mode = ref<ThemeMode>((localStorage.getItem(storageKey) as ThemeMode | null) || 'light')
  const isDark = computed(() => mode.value === 'dark')

  function applyTheme() {
    document.documentElement.dataset.theme = mode.value
    document.documentElement.style.colorScheme = mode.value
    localStorage.setItem(storageKey, mode.value)
  }

  function toggleTheme() {
    mode.value = mode.value === 'dark' ? 'light' : 'dark'
  }

  watch(mode, applyTheme, { immediate: true })

  return { mode, isDark, toggleTheme }
})
