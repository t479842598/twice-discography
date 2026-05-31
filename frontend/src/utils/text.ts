import type { LocaleCode, MultiLangText } from '@/api/types'

export function pickText(value: MultiLangText | null | undefined, locale: LocaleCode) {
  if (!value) return ''
  if (locale === 'zh-CN') return value.zh || value.en || value.romanized || ''
  if (locale === 'ja-JP') return value.ja || value.en || value.zh || ''
  if (locale === 'ko-KR') return value.ko || value.en || value.zh || ''
  return value.en || value.romanized || value.zh || ''
}

export function formatDuration(seconds?: number | null) {
  if (!seconds) return '--:--'
  const minutes = Math.floor(seconds / 60)
  const remain = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${remain}`
}

export function categoryLabel(category: string) {
  const labels: Record<string, string> = {
    group: '团体',
    solo: '单人',
    unit: '小分队',
    misamo: '小分队',
    cf: '广告歌曲',
    cover: '翻唱',
    predebut: '预出道',
  }

  return labels[category] || category
}

export function zodiacLabel(zodiac: string | null | undefined, locale: LocaleCode) {
  if (!zodiac) return '—'
  const labels: Record<string, Record<LocaleCode, string>> = {
    Aries: { 'zh-CN': '白羊座', 'en-US': 'Aries', 'ja-JP': '牡羊座', 'ko-KR': '양자리' },
    Taurus: { 'zh-CN': '金牛座', 'en-US': 'Taurus', 'ja-JP': '牡牛座', 'ko-KR': '황소자리' },
    Gemini: { 'zh-CN': '双子座', 'en-US': 'Gemini', 'ja-JP': '双子座', 'ko-KR': '쌍둥이자리' },
    Cancer: { 'zh-CN': '巨蟹座', 'en-US': 'Cancer', 'ja-JP': '蟹座', 'ko-KR': '게자리' },
    Leo: { 'zh-CN': '狮子座', 'en-US': 'Leo', 'ja-JP': '獅子座', 'ko-KR': '사자자리' },
    Virgo: { 'zh-CN': '处女座', 'en-US': 'Virgo', 'ja-JP': '乙女座', 'ko-KR': '처녀자리' },
    Libra: { 'zh-CN': '天秤座', 'en-US': 'Libra', 'ja-JP': '天秤座', 'ko-KR': '천칭자리' },
    Scorpio: { 'zh-CN': '天蝎座', 'en-US': 'Scorpio', 'ja-JP': '蠍座', 'ko-KR': '전갈자리' },
    Sagittarius: { 'zh-CN': '射手座', 'en-US': 'Sagittarius', 'ja-JP': '射手座', 'ko-KR': '사수자리' },
    Capricorn: { 'zh-CN': '摩羯座', 'en-US': 'Capricorn', 'ja-JP': '山羊座', 'ko-KR': '염소자리' },
    Aquarius: { 'zh-CN': '水瓶座', 'en-US': 'Aquarius', 'ja-JP': '水瓶座', 'ko-KR': '물병자리' },
    Pisces: { 'zh-CN': '双鱼座', 'en-US': 'Pisces', 'ja-JP': '魚座', 'ko-KR': '물고기자리' },
  }

  return labels[zodiac]?.[locale] || zodiac
}

export function albumTypeLabel(type: string) {
  const labels: Record<string, string> = {
    album: '专辑',
    mini: '迷你专辑',
    single: '单曲',
    unit: '小分队',
  }

  return labels[type] || type
}
