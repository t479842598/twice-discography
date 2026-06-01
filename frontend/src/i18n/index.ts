import { computed } from 'vue'
import { useLocaleStore } from '@/stores/locale'
import { localeLabels, supportedLocales, translate, type MessageKey } from './messages'

export function useI18n() {
  const localeStore = useLocaleStore()
  const locale = computed(() => localeStore.locale)

  function t(key: MessageKey, params?: Record<string, number | string>) {
    return translate(localeStore.locale, key, params)
  }

  return {
    locale,
    localeLabels,
    supportedLocales,
    t,
  }
}
