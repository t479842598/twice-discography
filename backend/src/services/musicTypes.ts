export const MUSIC_SOURCE_ORDER = ['qq', 'netease', 'kuwo', 'joox'] as const

export type MusicSource = (typeof MUSIC_SOURCE_ORDER)[number]

export const MUSIC_SOURCE_LABELS: Record<MusicSource, string> = {
  qq: 'QQ音乐',
  netease: '网易云',
  kuwo: '酷我',
  joox: 'JOOX',
}

export type QualityTag = 'lossless' | '320k' | 'hq' | 'standard' | 'low' | 'unknown'

export interface MusicQuality {
  tag: QualityTag
  label: string
  rank: number
  lossless: boolean
  bitrateKbps?: number
  text?: string
}

export interface MusicSearchHit {
  source: MusicSource
  providerId: string
  title: string
  artist: string
  album?: string | null
  coverUrl?: string | null
  durationSec?: number | null
  displayIndex?: number
  hasLyrics?: boolean
  metadata?: Record<string, unknown>
}

export interface MusicCandidate extends MusicSearchHit {
  sourceName: string
  quality: MusicQuality
  playable: boolean
  recommended: boolean
  selected: boolean
  hasLyrics: boolean
  audioUrl?: string | null
  lrc?: string | null
  pageUrl?: string | null
  failureReason?: string | null
}

export interface PublicMusicCandidate {
  source: MusicSource
  sourceName: string
  providerId: string
  title: string
  artist: string
  album?: string | null
  coverUrl?: string | null
  durationSec?: number | null
  quality: MusicQuality
  playable: boolean
  recommended: boolean
  selected: boolean
  hasLyrics: boolean
  pageUrl?: string | null
  failureReason?: string | null
}

export interface TrackMusicRecord {
  id: string
  titleZh: string
  titleEn: string
  titleJa?: string | null
  titleKo?: string | null
  titleRomanized?: string | null
  albumName?: string | null
  durationSec?: number | null
  musicSquareQuery?: string | null
  musicSquarePreferred?: MusicSource | null
  neteaseSongId?: string | null
  qqSongMid?: string | null
  kuwoRid?: string | null
  jooxSongMid?: string | null
  jooxSongId?: string | null
  musicSourceOrder?: MusicSource[] | null
}

export interface MusicProviderOptions {
  fetcher?: typeof fetch
  jooxToken?: string
  timeoutMs?: number
  quality?: QualityTag | 'best'
}

export interface MusicSearchOptions extends MusicProviderOptions {
  sources?: MusicSource[]
  limit?: number
}
