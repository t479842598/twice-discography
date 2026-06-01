import { getDatabase } from './database.js'

export interface MvConfigRecord {
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
  createdAt: number | null
  updatedAt: number | null
}

export interface MvConfigListOptions {
  query?: string
  page?: number
  pageSize?: number
  onlyWithMv?: boolean
  titleOnly?: boolean
}

interface MvConfigRow {
  track_id: string
  title_zh?: string | null
  title_en?: string | null
  album_name?: string | null
  fallback_bili_bvid?: string | null
  fallback_bili_page?: number | null
  fallback_yt_video_id?: string | null
  bili_bvid?: string | null
  bili_page?: number | null
  cover_url?: string | null
  aspect_ratio?: string | null
  is_home_featured?: number | null
  sort_order?: number | null
  enabled?: number | null
  created_at?: number | null
  updated_at?: number | null
}

function mapRow(row: MvConfigRow): MvConfigRecord {
  return {
    trackId: row.track_id,
    titleZh: row.title_zh ?? null,
    titleEn: row.title_en ?? null,
    albumName: row.album_name ?? null,
    fallbackBiliBvid: row.fallback_bili_bvid ?? null,
    fallbackBiliPage: row.fallback_bili_page ?? 1,
    fallbackYtVideoId: row.fallback_yt_video_id ?? null,
    biliBvid: row.bili_bvid ?? null,
    biliPage: row.bili_page ?? row.fallback_bili_page ?? 1,
    coverUrl: row.cover_url ?? null,
    aspectRatio: row.aspect_ratio ?? '16 / 9',
    isHomeFeatured: Boolean(row.is_home_featured),
    sortOrder: Number(row.sort_order ?? 0),
    enabled: row.enabled === null || row.enabled === undefined ? true : Boolean(row.enabled),
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  }
}

function selectMvSql(where: string) {
  return `
    SELECT
      tracks.id AS track_id,
      tracks.title_zh,
      tracks.title_en,
      albums.name_en AS album_name,
      tracks.bili_bvid AS fallback_bili_bvid,
      tracks.bili_page AS fallback_bili_page,
      tracks.yt_video_id AS fallback_yt_video_id,
      mv_configs.bili_bvid,
      mv_configs.bili_page,
      mv_configs.cover_url,
      mv_configs.aspect_ratio,
      mv_configs.is_home_featured,
      mv_configs.sort_order,
      mv_configs.enabled,
      mv_configs.created_at,
      mv_configs.updated_at
    FROM tracks
    LEFT JOIN albums ON albums.id = tracks.album_id
    LEFT JOIN mv_configs ON mv_configs.track_id = tracks.id
    ${where}
  `
}

function mvListWhere(options: MvConfigListOptions) {
  const conditions: string[] = []
  const params: Array<string | number> = []
  const query = options.query?.trim()

  if (query) {
    const like = `%${query}%`
    conditions.push('(tracks.title_zh LIKE ? OR tracks.title_en LIKE ? OR tracks.id LIKE ? OR mv_configs.bili_bvid LIKE ? OR tracks.bili_bvid LIKE ?)')
    params.push(like, like, like, like, like)
  }

  if (options.onlyWithMv) {
    conditions.push('(mv_configs.bili_bvid IS NOT NULL OR tracks.bili_bvid IS NOT NULL OR tracks.yt_video_id IS NOT NULL)')
  }

  if (options.titleOnly) {
    conditions.push('tracks.is_title = 1')
  }

  return {
    where: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
    params,
  }
}

export function listMvConfigs(options: MvConfigListOptions = {}) {
  const page = Math.max(1, Math.floor(options.page ?? 1))
  const pageSize = Math.min(100, Math.max(10, Math.floor(options.pageSize ?? 20)))
  const offset = (page - 1) * pageSize
  const { where, params } = mvListWhere(options)
  const totalRow = getDatabase().prepare(`
    SELECT COUNT(*) AS total
    FROM tracks
    LEFT JOIN mv_configs ON mv_configs.track_id = tracks.id
    ${where}
  `).get(...params) as { total: number }
  const rows = getDatabase().prepare(`
    ${selectMvSql(where)}
    ORDER BY COALESCE(mv_configs.sort_order, 999999), tracks.title_en
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset) as MvConfigRow[]

  return {
    mvs: rows.map(mapRow),
    total: Number(totalRow.total),
    page,
    pageSize,
  }
}

export function getMvConfig(trackId: string) {
  const row = getDatabase().prepare(`${selectMvSql('WHERE tracks.id = ?')} LIMIT 1`).get(trackId) as MvConfigRow | undefined
  return row ? mapRow(row) : null
}

export function upsertMvConfig(input: {
  trackId: string
  biliBvid?: string | null
  biliPage?: number | null
  coverUrl?: string | null
  aspectRatio?: string | null
  isHomeFeatured?: boolean
  sortOrder?: number
  enabled?: boolean
}) {
  const now = Date.now()
  getDatabase().prepare(`
    INSERT INTO mv_configs (
      track_id, bili_bvid, bili_page, cover_url, aspect_ratio,
      is_home_featured, sort_order, enabled, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(track_id) DO UPDATE SET
      bili_bvid = excluded.bili_bvid,
      bili_page = excluded.bili_page,
      cover_url = excluded.cover_url,
      aspect_ratio = excluded.aspect_ratio,
      is_home_featured = excluded.is_home_featured,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `).run(
    input.trackId,
    input.biliBvid?.trim() || null,
    input.biliPage ?? 1,
    input.coverUrl?.trim() || null,
    input.aspectRatio?.trim() || '16 / 9',
    Number(Boolean(input.isHomeFeatured)),
    input.sortOrder ?? 0,
    input.enabled === undefined ? 1 : Number(input.enabled),
    now,
    now,
  )
  return getMvConfig(input.trackId)
}

export function listHomeFeaturedMvs() {
  const rows = getDatabase().prepare(`${selectMvSql('WHERE mv_configs.enabled = 1 AND mv_configs.is_home_featured = 1')} ORDER BY mv_configs.sort_order, tracks.title_en`).all() as MvConfigRow[]
  return rows.map(mapRow)
}
