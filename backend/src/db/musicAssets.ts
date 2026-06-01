import { getDatabase } from './database.js'
import { MUSIC_SOURCE_LABELS, type MusicCandidate, type MusicSource, type QualityTag, type TrackMusicRecord } from '../services/musicTypes.js'
import { normalizeQuality } from '../services/musicSelection.js'

export type MusicAssetStatus = 'pending' | 'ready' | 'failed'

export interface MusicAssetRecord {
  id: string
  trackId?: string | null
  source: MusicSource
  providerId: string
  qualityTag: QualityTag
  r2Key: string
  publicUrl: string
  status: MusicAssetStatus
  etag?: string | null
  contentType?: string | null
  sizeBytes?: number | null
  error?: string | null
  createdAt: number
  updatedAt: number
}

export interface MusicAssetLookup {
  trackId?: string | null
  source?: MusicSource | null
  providerId?: string | null
  quality?: QualityTag | 'best'
}

function ensureMusicAssetsSchema() {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS music_assets (
      id TEXT PRIMARY KEY,
      track_id TEXT,
      source TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      quality_tag TEXT NOT NULL,
      r2_key TEXT NOT NULL,
      public_url TEXT NOT NULL,
      status TEXT NOT NULL,
      etag TEXT,
      content_type TEXT,
      size_bytes INTEGER,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_music_assets_identity ON music_assets (source, provider_id, quality_tag);
    CREATE INDEX IF NOT EXISTS idx_music_assets_track_status ON music_assets (track_id, status);
    CREATE INDEX IF NOT EXISTS idx_music_assets_status ON music_assets (status);
  `)
}

function rowToAsset(row: Record<string, unknown>): MusicAssetRecord {
  return {
    id: String(row.id),
    trackId: row.track_id ? String(row.track_id) : null,
    source: String(row.source) as MusicSource,
    providerId: String(row.provider_id),
    qualityTag: String(row.quality_tag) as QualityTag,
    r2Key: String(row.r2_key),
    publicUrl: String(row.public_url),
    status: String(row.status) as MusicAssetStatus,
    etag: row.etag ? String(row.etag) : null,
    contentType: row.content_type ? String(row.content_type) : null,
    sizeBytes: typeof row.size_bytes === 'number' ? row.size_bytes : null,
    error: row.error ? String(row.error) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function acceptsQuality(assetQuality: string, requested?: QualityTag | 'best') {
  return !requested || requested === 'best' || assetQuality === requested
}

export function findReadyMusicAsset(lookup: MusicAssetLookup) {
  ensureMusicAssetsSchema()
  const conditions = ['status = ?']
  const values: unknown[] = ['ready']

  if (lookup.trackId) {
    conditions.push('track_id = ?')
    values.push(lookup.trackId)
  }

  if (lookup.source) {
    conditions.push('source = ?')
    values.push(lookup.source)
  }

  if (lookup.providerId) {
    conditions.push('provider_id = ?')
    values.push(lookup.providerId)
  }

  if (lookup.quality && lookup.quality !== 'best') {
    conditions.push('quality_tag = ?')
    values.push(lookup.quality)
  }

  const rows = getDatabase().prepare(`
    SELECT *
    FROM music_assets
    WHERE ${conditions.join(' AND ')}
    ORDER BY
      CASE quality_tag
        WHEN 'lossless' THEN 50
        WHEN '320k' THEN 40
        WHEN 'hq' THEN 30
        WHEN 'standard' THEN 20
        WHEN 'low' THEN 10
        ELSE 0
      END DESC,
      updated_at DESC
    LIMIT 1
  `).all(...values) as Record<string, unknown>[]

  const row = rows.find((item) => acceptsQuality(String(item.quality_tag), lookup.quality))
  return row ? rowToAsset(row) : null
}

export function findMusicAssetByIdentity(source: MusicSource, providerId: string, qualityTag: QualityTag) {
  ensureMusicAssetsSchema()
  const row = getDatabase().prepare(`
    SELECT *
    FROM music_assets
    WHERE source = ? AND provider_id = ? AND quality_tag = ?
  `).get(source, providerId, qualityTag) as Record<string, unknown> | undefined

  return row ? rowToAsset(row) : null
}

export function upsertPendingMusicAsset(input: {
  id: string
  trackId?: string | null
  source: MusicSource
  providerId: string
  qualityTag: QualityTag
  r2Key: string
  publicUrl: string
}) {
  ensureMusicAssetsSchema()
  const now = Date.now()
  getDatabase().prepare(`
    INSERT INTO music_assets (
      id, track_id, source, provider_id, quality_tag, r2_key, public_url,
      status, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(source, provider_id, quality_tag) DO UPDATE SET
      track_id = COALESCE(excluded.track_id, music_assets.track_id),
      r2_key = excluded.r2_key,
      public_url = excluded.public_url,
      status = CASE WHEN music_assets.status = 'ready' THEN music_assets.status ELSE 'pending' END,
      error = NULL,
      updated_at = excluded.updated_at
  `).run(input.id, input.trackId ?? null, input.source, input.providerId, input.qualityTag, input.r2Key, input.publicUrl, now, now)

  return findMusicAssetByIdentity(input.source, input.providerId, input.qualityTag)
}

export function markMusicAssetReady(input: {
  source: MusicSource
  providerId: string
  qualityTag: QualityTag
  etag?: string | null
  contentType?: string | null
  sizeBytes?: number | null
}) {
  ensureMusicAssetsSchema()
  getDatabase().prepare(`
    UPDATE music_assets
    SET status = 'ready', etag = ?, content_type = ?, size_bytes = ?, error = NULL, updated_at = ?
    WHERE source = ? AND provider_id = ? AND quality_tag = ?
  `).run(input.etag ?? null, input.contentType ?? null, input.sizeBytes ?? null, Date.now(), input.source, input.providerId, input.qualityTag)
}

export function markMusicAssetFailed(input: {
  source: MusicSource
  providerId: string
  qualityTag: QualityTag
  error: string
}) {
  ensureMusicAssetsSchema()
  getDatabase().prepare(`
    UPDATE music_assets
    SET status = 'failed', error = ?, updated_at = ?
    WHERE source = ? AND provider_id = ? AND quality_tag = ?
  `).run(input.error.slice(0, 1000), Date.now(), input.source, input.providerId, input.qualityTag)
}

export function getReadyMusicAssetsSizeBytes() {
  ensureMusicAssetsSchema()
  const row = getDatabase().prepare(`
    SELECT COALESCE(SUM(size_bytes), 0) AS total
    FROM music_assets
    WHERE status = 'ready'
  `).get() as { total: number } | undefined

  return row?.total ?? 0
}

export function assetToMusicCandidate(asset: MusicAssetRecord, track?: TrackMusicRecord | null): MusicCandidate {
  return {
    source: asset.source,
    sourceName: MUSIC_SOURCE_LABELS[asset.source],
    providerId: asset.providerId,
    title: track?.titleEn || track?.titleZh || asset.providerId,
    artist: 'TWICE',
    album: track?.albumName ?? null,
    durationSec: track?.durationSec ?? null,
    quality: normalizeQuality({ tag: asset.qualityTag, label: asset.qualityTag.toUpperCase(), text: asset.contentType ?? undefined }),
    playable: true,
    recommended: asset.source === 'qq',
    selected: true,
    hasLyrics: false,
    audioUrl: asset.publicUrl,
    lrc: null,
    pageUrl: null,
    failureReason: null,
  }
}
