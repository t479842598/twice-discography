import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/api/client'
import type { LocaleCode } from '@/api/types'
import { isLocaleCode, localeLabels, setDocumentLocale } from '@/i18n/messages'

const localeMap: Record<string, LocaleCode> = {
  CN: 'zh-CN',
  TW: 'zh-TW',
  HK: 'zh-TW',
  MO: 'zh-TW',
  JP: 'ja-JP',
  KR: 'ko-KR',
}

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<LocaleCode>('zh-CN')
  const country = ref('UNKNOWN')
  const initialized = ref(false)

  const label = computed(() => localeLabels[locale.value])

  function applyLocale(next: LocaleCode) {
    locale.value = next
    setDocumentLocale(next)
  }

  async function init() {
    const override = typeof localStorage === 'undefined' ? null : localStorage.getItem('locale-override')
    if (isLocaleCode(override)) {
      applyLocale(override)
      initialized.value = true
      return
    }

    try {
      const hint = await api.regionHint()
      country.value = hint.country
      applyLocale(isLocaleCode(hint.suggestedLocale) ? hint.suggestedLocale : localeMap[hint.country] || 'zh-CN')
    } catch {
      applyLocale('zh-CN')
    } finally {
      initialized.value = true
    }
  }

  function switchLocale(next: LocaleCode) {
    applyLocale(next)
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('locale-override', next)
    }
  }

  return { locale, country, initialized, label, init, switchLocale }
})


