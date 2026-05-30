import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { LocaleCode } from '@/api/types'

const localeMap: Record<string, LocaleCode> = {
  CN: 'zh-CN',
  TW: 'zh-CN',
  HK: 'zh-CN',
  MO: 'zh-CN',
  JP: 'ja-JP',
  KR: 'ko-KR',
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<LocaleCode>('zh-CN')
  const country = ref('UNKNOWN')
  const initialized = ref(false)

  const label = computed(() => ({
    'zh-CN': '中文',
    'en-US': 'English',
    'ja-JP': '日本語',
    'ko-KR': '한국어',
  }[locale.value]))

  async function init() {
    const override = localStorage.getItem('locale-override') as LocaleCode | null
    if (override) {
      locale.value = override
      initialized.value = true
      return
    }

    try {
      const hint = await api.regionHint()
      country.value = hint.country
      locale.value = localeMap[hint.country] || 'zh-CN'
    } catch {
      locale.value = 'zh-CN'
    } finally {
      initialized.value = true
    }
  }

  function switchLocale(next: LocaleCode) {
    locale.value = next
    localStorage.setItem('locale-override', next)
  }

  return { locale, country, initialized, label, init, switchLocale }
})


