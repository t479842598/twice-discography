import type {
  AdminActivityItem,
  AdminMvConfig,
  AdminMvListResponse,
  AdminRole,
  AdminStats,
  AdminUser,
  BiliProfile,
  BiliVideoMeta,
  Album,
  CatalogOverview,
  CfSong,
  Cover,
  HomeFeaturedMv,
  Member,
  MusicCandidate,
  MusicResolveResponse,
  MusicSearchResponse,
  MvPlaybackResponse,
  PlaybackResponse,
  Track,
} from './types'

const baseUrl = import.meta.env.VITE_API_BASE || '/api'
const staticBaseUrl = (import.meta.env.VITE_STATIC_BASE || '/static').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload: unknown = null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

function withStaticBase(value: string | null | undefined) {
  if (!value || /^https?:\/\//i.test(value) || !value.startsWith('/static/')) return value ?? null
  return `${staticBaseUrl}${value.slice(7)}`
}

function normalizeStaticUrls<T>(payload: T): T {
  if (!payload || typeof payload !== 'object') return payload
  if (Array.isArray(payload)) return payload.map(normalizeStaticUrls) as T

  const record = payload as Record<string, unknown>
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    normalized[key] = key === 'coverLocal' || key === 'coverRemote' || key === 'photoLocal'
      ? withStaticBase(value as string | null | undefined)
      : normalizeStaticUrls(value)
  }
  return normalized as T
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (options.body && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(payload?.message || payload?.error || 'Request failed', response.status, payload)
  }

  return normalizeStaticUrls(payload as T)
}

export const api = {
  overview: () => request<CatalogOverview>('/catalog/overview'),
  albums: () => request<{ albums: Album[] }>('/albums'),
  album: (id: string) => request<{ album: Album }>(`/albums/${encodeURIComponent(id)}`),
  tracks: (params: { category?: string; year?: number; q?: string } = {}) => {
    const search = new URLSearchParams()
    if (params.category) search.set('category', params.category)
    if (params.year) search.set('year', String(params.year))
    if (params.q) search.set('q', params.q)
    const query = search.toString()
    return request<{ tracks: Track[] }>(`/tracks${query ? `?${query}` : ''}`)
  },
  track: (id: string) => request<{ track: Track }>(`/tracks/${encodeURIComponent(id)}`),
  members: () => request<{ members: Member[] }>('/members'),
  member: (id: string) => request<{ member: Member }>(`/members/${encodeURIComponent(id)}`),
  cfs: () => request<{ cfs: CfSong[] }>('/cfs'),
  covers: () => request<{ covers: Cover[] }>('/covers'),
  search: (q: string) => request<{ query: string; results: { albums: Album[]; tracks: Track[]; members: Member[]; cfs: CfSong[]; covers: Cover[] } }>(`/search?q=${encodeURIComponent(q)}`),
  regionHint: () => request<{ country: string; region: 'CN' | 'GLOBAL'; suggestedLocale: string }>('/meta/region-hint'),
  musicSearch: (params: { q: string; sources?: string[]; limit?: number }) => {
    const search = new URLSearchParams({ q: params.q })
    if (params.sources?.length) search.set('sources', params.sources.join(','))
    if (params.limit) search.set('limit', String(params.limit))
    return request<MusicSearchResponse>(`/music/search?${search.toString()}`)
  },
  musicResolve: (params: { q: string; source: string; providerId: string; quality?: string }) => {
    const search = new URLSearchParams({
      q: params.q,
      source: params.source,
      providerId: params.providerId,
    })
    if (params.quality) search.set('quality', String(params.quality))
    return request<MusicResolveResponse>(`/music/resolve?${search.toString()}`)
  },
  musicCandidates: (trackId: string) => request<{ trackId: string; selectedSource: string | null; recommendedSource: string; candidates: MusicCandidate[] }>(`/tracks/${encodeURIComponent(trackId)}/music-candidates`),
  playback: (trackId: string, source?: string) => {
    const query = source ? `?source=${encodeURIComponent(source)}` : ''
    return request<PlaybackResponse>(`/tracks/${encodeURIComponent(trackId)}/playback${query}`)
  },
  adminLogin: (email: string, password: string) => request<{ user: AdminUser }>('/admin/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  adminLogout: () => request<{ ok: boolean }>('/admin/auth/logout', { method: 'POST' }),
  adminSession: () => request<{ user: AdminUser | null }>('/admin/session'),
  adminMe: () => request<{ user: AdminUser }>('/admin/me'),
  adminUsers: () => request<{ users: AdminUser[] }>('/admin/users'),
  adminCreateUser: (input: { email: string; displayName: string; password: string; roles: string[] }) => request<{ user: AdminUser }>('/admin/users', { method: 'POST', body: JSON.stringify(input) }),
  adminUpdateUser: (id: string, input: { displayName?: string; password?: string; roles?: string[]; disabled?: boolean }) => request<{ user: AdminUser }>(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  adminRoles: () => request<{ roles: AdminRole[] }>('/admin/roles'),
  adminCreateRole: (input: { id: string; label: string }) => request<{ role: AdminRole }>('/admin/roles', { method: 'POST', body: JSON.stringify(input) }),
  adminUpdateRole: (id: string, input: { label: string }) => request<{ role: AdminRole }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  adminDeleteRole: (id: string) => request<{ ok: boolean }>(`/admin/roles/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  adminMvs: (params: { q?: string; page?: number; pageSize?: number; onlyWithMv?: boolean; titleOnly?: boolean } = {}) => {
    const search = new URLSearchParams()
    if (params.q) search.set('q', params.q)
    if (params.page) search.set('page', String(params.page))
    if (params.pageSize) search.set('pageSize', String(params.pageSize))
    if (params.onlyWithMv) search.set('onlyWithMv', 'true')
    if (params.titleOnly) search.set('titleOnly', 'true')
    const query = search.toString()
    return request<AdminMvListResponse>(`/admin/mvs${query ? `?${query}` : ``}`)
  },
  adminParseBiliMv: (url: string) => request<{ meta: BiliVideoMeta }>('/admin/mvs/parse-bili', { method: 'POST', body: JSON.stringify({ url }) }),
  adminSaveMv: (input: Partial<AdminMvConfig> & { trackId: string }) => request<{ mv: AdminMvConfig }>('/admin/mvs', { method: 'POST', body: JSON.stringify(input) }),
  adminBiliProfile: () => request<{ configured: boolean; profile: BiliProfile | null; message: string }>('/admin/bili-profile'),
  adminBiliCredential: () => request<{ configured: boolean; lastVerifiedAt: number | null; lastVerifyStatus: string | null; lastVerifyMessage: string | null }>('/admin/bili-credential'),
  adminSaveBiliCredential: (cookie: string) => request('/admin/bili-credential', { method: 'PUT', body: JSON.stringify({ cookie }) }),
  adminVerifyBiliCredential: () => request<{ ok: boolean; message: string }>('/admin/bili-credential/verify', { method: 'POST' }),
  mvPlayback: (trackId: string) => request<MvPlaybackResponse>(`/mv/${encodeURIComponent(trackId)}/playback`),
  homeFeaturedMvs: () => request<{ mvs: HomeFeaturedMv[] }>('/mv/home-featured'),
  adminStats: () => request<AdminStats>('/admin/stats'),
  adminRecentActivity: () => request<{ items: AdminActivityItem[] }>('/admin/recent-activity'),
}

