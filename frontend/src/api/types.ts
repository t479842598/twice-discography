export type LocaleCode = 'zh-CN' | 'en-US' | 'ja-JP' | 'ko-KR'

export interface MultiLangText {
  zh: string
  en: string
  ja?: string
  ko?: string
  romanized?: string
}

export interface Album {
  id: string
  type: string
  language: string
  releaseDate: string
  year: number
  coverLocal: string | null
  title: MultiLangText
  description: MultiLangText
  trackCount: number
  tracks?: Track[]
}

export interface Track {
  id: string
  albumId: string | null
  albumTitle: MultiLangText | null
  albumReleaseDate: string | null
  coverLocal: string | null
  year: number | null
  trackNo: number | null
  durationSec: number | null
  isTitle: boolean
  category: string
  memberIds: string[]
  language: string | null
  title: MultiLangText
  note: MultiLangText
  musicSquareQuery: string | null
  musicSquarePreferred: string | null
}

export interface Member {
  id: string
  name: MultiLangText
  realName: MultiLangText
  birthday: string
  heightCm: number | null
  bloodType: string | null
  mbti: string | null
  zodiac: string | null
  debutDate: string | null
  nationalityCode: string
  flagEmoji: string
  positions: string[]
  colorHex: string
  photoLocal: string | null
  bio: MultiLangText
  tracks?: Track[]
  covers?: Cover[]
}

export interface CfSong {
  id: string
  brand: string
  year: number
  country: string
  memberIds: string[]
  title: MultiLangText
  description: MultiLangText
}

export interface Cover {
  id: string
  performedAt: string
  isPredebut: boolean
  originalArtist: string
  originalSong: string
  performerMemberIds: string[]
  year: number
  language: string
  note: MultiLangText
}

export interface CatalogOverview {
  stats: {
    albums: number
    tracks: number
    members: number
    cfs: number
    covers: number
    solos: number
    units: number
  }
  years: Array<{
    year: number
    albums: Album[]
    tracks: Track[]
    cfs: CfSong[]
    covers: Cover[]
  }>
  featuredAlbums: Album[]
  featuredTracks: Track[]
  categories: Array<{ key: string; label: string; count: number }>
}

export interface MusicQuality {
  tag: string
  label: string
  rank: number
  lossless: boolean
  bitrateKbps?: number
  text?: string
}

export interface MusicCandidate {
  source: string
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

export interface PlaybackResponse {
  trackId: string
  selectedSource: string
  recommendedSource: string
  selected: MusicCandidate
  audioUrl: string
  lrc: string | null
  lrcAvailable: boolean
  candidates: MusicCandidate[]
}



