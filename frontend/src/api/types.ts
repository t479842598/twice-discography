export type LocaleCode = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP' | 'ko-KR'

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
  coverRemote?: string | null
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
  coverRemote?: string | null
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
  ytVideoId?: string | null
  biliBvid?: string | null
  biliPage?: number | null
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
  nationality: string
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

export interface MusicSearchResponse {
  query: string
  sources: string[]
  limit: number
  results: MusicCandidate[]
}

export interface MusicResolveResponse {
  query: string
  source: string
  providerId: string
  selected: MusicCandidate
  audioUrl: string
  lrc: string | null
  lrcAvailable: boolean
}




export interface AdminUser {
  id: string
  email: string
  displayName: string
  roles: string[]
}

export interface AdminRole {
  id: string
  label: string
  system: boolean
  createdAt: number
}

export interface AdminMvConfig {
  trackId: string
  titleZh: string | null
  titleEn: string | null
  albumName: string | null
  fallbackBiliBvid: string | null
  fallbackBiliPage: number | null
  fallbackYtVideoId: string | null
  biliBvid: string | null
  biliPage: number
  coverUrl: string | null
  aspectRatio: string
  isHomeFeatured: boolean
  sortOrder: number
  enabled: boolean
}

export interface AdminMvListResponse {
  mvs: AdminMvConfig[]
  total: number
  page: number
  pageSize: number
}

export interface BiliProfile {
  mid: number | null
  uname: string
  face: string | null
  level: number | null
  vipStatus: number | null
  vipType: number | null
  pendantName: string | null
  pendantImage: string | null
  officialTitle: string | null
  follower: number | null
  following: number | null
  dynamic: number | null
}

export interface BiliVideoMeta {
  biliBvid: string
  biliPage: number
  coverUrl: string | null
  title: string | null
  pages: Array<{ page: number; cid: number; part: string | null }>
}

export interface MvPlaybackResponse {
  trackId: string
  source: 'bilibili-proxy' | 'bilibili-iframe'
  quality: number | null
  videoUrl: string | null
  expiresAt: number | null
  fallbackIframeUrl: string
  message: string
}

export interface HomeFeaturedMv {
  trackId: string
  title: MultiLangText
  albumName: string | null
  biliBvid: string | null
  biliPage: number
  ytVideoId: string | null
  coverUrl: string | null
  aspectRatio: string
  isHomeFeatured: boolean
  sortOrder: number
  enabled: boolean
}

export interface AdminStats {
  catalog: { albums: number; tracks: number; members: number; cfs: number; covers: number }
  mvs: { pending: number; homeFeatured: number }
  admins: number
  r2Cache: { readyAssets: number; totalBytes: number }
  biliCredential: { configured: boolean; lastVerifiedAt: number | null; lastVerifyStatus: string | null; lastVerifyMessage: string | null }
}

export interface AdminActivityItem {
  type: string
  title: string
  description: string
  time: number
}
