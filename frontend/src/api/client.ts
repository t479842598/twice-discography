import type {
  Album,
  CatalogOverview,
  CfSong,
  Cover,
  Member,
  MusicCandidate,
  PlaybackResponse,
  Track,
} from './types'

const baseUrl = import.meta.env.VITE_API_BASE || '/api'

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  if (!response.ok) {
    throw new ApiError(payload?.message || payload?.error || 'Request failed', response.status, payload)
  }

  return payload as T
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
  musicCandidates: (trackId: string) => request<{ trackId: string; selectedSource: string | null; recommendedSource: string; candidates: MusicCandidate[] }>(`/tracks/${encodeURIComponent(trackId)}/music-candidates`),
  playback: (trackId: string, source?: string) => {
    const query = source ? `?source=${encodeURIComponent(source)}` : ''
    return request<PlaybackResponse>(`/tracks/${encodeURIComponent(trackId)}/playback${query}`)
  },
}
