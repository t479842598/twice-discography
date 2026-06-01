import { getDatabase } from './database.js'
import type { MusicSource } from '../services/musicTypes.js'

export interface MusicLyricRecord {
  id: string
  trackId?: string | null
  source: MusicSource
  providerId: string
  lrc: string
  createdAt: number
  updatedAt: number
}

function ensureMusicLyricsSchema() {
  getDatabase().exec(`
    CREATE TABLE IF NOT EXISTS music_lyrics (
      id TEXT PRIMARY KEY,
      track_id TEXT,
      source TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      lrc TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_music_lyrics_identity ON music_lyrics (source, provider_id);
    CREATE INDEX IF NOT EXISTS idx_music_lyrics_track_source ON music_lyrics (track_id, source);
  `)
}

function rowToLyric(row: Record<string, unknown>): MusicLyricRecord {
  return {
    id: String(row.id),
    trackId: row.track_id ? String(row.track_id) : null,
    source: String(row.source) as MusicSource,
    providerId: String(row.provider_id),
    lrc: String(row.lrc),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

export function findMusicLyric(source: MusicSource, providerId: string) {
  ensureMusicLyricsSchema()
  const row = getDatabase().prepare(`
    SELECT *
    FROM music_lyrics
    WHERE source = ? AND provider_id = ?
  `).get(source, providerId) as Record<string, unknown> | undefined

  return row ? rowToLyric(row) : null
}

export function upsertMusicLyric(input: {
  trackId?: string | null
  source: MusicSource
  providerId: string
  lrc?: string | null
}) {
  const lrc = input.lrc?.trim()
  if (!lrc) return null

  ensureMusicLyricsSchema()
  const now = Date.now()
  const id = `${input.source}:${input.providerId}`
  getDatabase().prepare(`
    INSERT INTO music_lyrics (id, track_id, source, provider_id, lrc, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, provider_id) DO UPDATE SET
      track_id = COALESCE(excluded.track_id, music_lyrics.track_id),
      lrc = excluded.lrc,
      updated_at = excluded.updated_at
  `).run(id, input.trackId ?? null, input.source, input.providerId, lrc, now, now)

  return findMusicLyric(input.source, input.providerId)
}
