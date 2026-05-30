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

export function albumTypeLabel(type: string) {
  const labels: Record<string, string> = {
    album: '专辑',
    mini: '迷你专辑',
    single: '单曲',
    unit: '小分队',
  }

  return labels[type] || type
}
