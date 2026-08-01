import { describe, expect, it } from 'vitest'
import { messages, supportedLocales, translate } from '@/i18n/messages'
import type { LocaleCode } from '@/api/types'

describe('i18n completeness', () => {
  const zhCNKeys = Object.keys(messages['zh-CN']) as Array<keyof typeof messages['zh-CN']>

  it('covers every zh-CN key in all five locales', () => {
    for (const locale of supportedLocales) {
      const localeMessages = messages[locale]
      const missing = zhCNKeys.filter((key) => !(key in localeMessages))
      expect(missing, `${locale} missing keys`).toEqual([])
    }
  })

  it('derives zh-TW from zh-CN without gaps', () => {
    const zhTW = messages['zh-TW']
    const gaps = zhCNKeys.filter((key) => !zhTW[key] || zhTW[key] === '')
    expect(gaps).toEqual([])
  })

  it('has no empty translations in any locale', () => {
    for (const locale of supportedLocales) {
      const empties = Object.entries(messages[locale])
        .filter(([, value]) => !value || !value.trim())
        .map(([key]) => key)
      expect(empties, `${locale} empty values`).toEqual([])
    }
  })

  it('translates interpolated keys for every locale', () => {
    const locale = 'en-US' as LocaleCode
    expect(translate(locale, 'home.slideAria', { current: 2, total: 5 })).toContain('2')
    expect(translate(locale, 'mv.proxyReadyQuality', { quality: '1080P' })).toContain('1080P')
  })
})
