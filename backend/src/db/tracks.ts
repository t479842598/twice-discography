import { getDatabase } from './database.js'
import { isMusicSource, normalizeSourceOrder } from '../services/musicSelection.js'
import type { MusicSource, TrackMusicRecord } from '../services/musicTypes.js'

interface TrackMusicRow {
  id: string
  title_zh: string
  title_en: string
  title_ja?: string | null
  title_ko?: string | null
  title_romanized?: string | null
  album_name?: string | null
  duration_sec?: number | null
  music_square_query?: string | null
  music_square_preferred?: string | null
  netease_song_id?: string | null
  qq_song_mid?: string | null
  kuwo_rid?: string | null
  joox_song_mid?: string | null
  joox_song_id?: string | null
  music_source_order_json?: string | null
}

function parseSourceOrder(value?: string | null) {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return null

    const sources = parsed.filter((source): source is MusicSource => (
      typeof source === 'string' && isMusicSource(source)
    ))

    return normalizeSourceOrder(sources)
  } catch {
    return null
  }
}

function normalizePreferred(value?: string | null) {
  return value && isMusicSource(value) ? value : null
}

function mapTrackMusicRow(row: TrackMusicRow): TrackMusicRecord {
  return {
    id: row.id,
    titleZh: row.title_zh,
    titleEn: row.title_en,
    titleJa: row.title_ja,
    titleKo: row.title_ko,
    titleRomanized: row.title_romanized,
    albumName: row.album_name,
    durationSec: row.duration_sec,
    musicSquareQuery: row.music_square_query,
    musicSquarePreferred: normalizePreferred(row.music_square_preferred),
    neteaseSongId: row.netease_song_id,
    qqSongMid: row.qq_song_mid,
    kuwoRid: row.kuwo_rid,
    jooxSongMid: row.joox_song_mid,
    jooxSongId: row.joox_song_id,
    musicSourceOrder: parseSourceOrder(row.music_source_order_json),
  }
}

export function getTrackMusicRecord(trackId: string) {
  const db = getDatabase()

  try {
    const row = db.prepare(`
      SELECT
        tracks.id,
        tracks.title_zh,
        tracks.title_en,
        tracks.title_ja,
        tracks.title_ko,
        tracks.title_romanized,
        albums.name_en AS album_name,
        tracks.duration_sec,
        tracks.music_square_query,
        tracks.music_square_preferred,
        tracks.netease_song_id,
        tracks.qq_song_mid,
        tracks.kuwo_rid,
        tracks.joox_song_mid,
        tracks.joox_song_id,
        tracks.music_source_order_json
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      WHERE tracks.id = ?
    `).get(trackId) as TrackMusicRow | undefined

    return row ? mapTrackMusicRow(row) : null
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/no such table|no such column/i.test(message)) return null
    throw error
  }
}

export function listTrackMusicRecords() {
  const db = getDatabase()

  try {
    const rows = db.prepare(`
      SELECT
        tracks.id,
        tracks.title_zh,
        tracks.title_en,
        tracks.title_ja,
        tracks.title_ko,
        tracks.title_romanized,
        albums.name_en AS album_name,
        tracks.duration_sec,
        tracks.music_square_query,
        tracks.music_square_preferred,
        tracks.netease_song_id,
        tracks.qq_song_mid,
        tracks.kuwo_rid,
        tracks.joox_song_mid,
        tracks.joox_song_id,
        tracks.music_source_order_json
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      ORDER BY tracks.id
    `).all() as TrackMusicRow[]

    return rows.map(mapTrackMusicRow)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/no such table|no such column/i.test(message)) return []
    throw error
  }
}
