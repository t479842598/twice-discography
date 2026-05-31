import { getDatabase } from './database.js'

type Row = Record<string, unknown>

function parseJsonArray(value: unknown) {
  if (typeof value !== 'string' || !value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function titles(row: Row, prefix = '') {
  return {
    zh: row[`${prefix}title_zh`] ?? row[`${prefix}name_zh`] ?? row[`${prefix}song_title_zh`] ?? '',
    en: row[`${prefix}title_en`] ?? row[`${prefix}name_en`] ?? row[`${prefix}song_title_en`] ?? '',
    ja: row[`${prefix}title_ja`] ?? row[`${prefix}name_ja`] ?? row[`${prefix}song_title_ja`] ?? '',
    ko: row[`${prefix}title_ko`] ?? row[`${prefix}name_ko`] ?? row[`${prefix}song_title_ko`] ?? '',
    romanized: row[`${prefix}title_romanized`] ?? row[`${prefix}name_romanized`] ?? row[`${prefix}song_title_romanized`] ?? '',
  }
}

function notes(row: Row) {
  return {
    zh: row.note_zh ?? row.desc_zh ?? '',
    en: row.note_en ?? row.desc_en ?? '',
    ja: row.note_ja ?? row.desc_ja ?? '',
    ko: row.note_ko ?? row.desc_ko ?? '',
  }
}

export function mapAlbum(row: Row) {
  return {
    id: row.id,
    type: row.type,
    language: row.language,
    releaseDate: row.release_date,
    year: Number(String(row.release_date).slice(0, 4)),
    coverLocal: row.cover_local,
    title: titles(row),
    description: {
      zh: row.desc_zh ?? '',
      en: row.desc_en ?? '',
      ja: row.desc_ja ?? '',
      ko: row.desc_ko ?? '',
    },
    trackCount: row.track_count ? Number(row.track_count) : 0,
  }
}

export function mapTrack(row: Row) {
  return {
    id: row.id,
    albumId: row.album_id,
    albumTitle: row.album_name_en
      ? {
          zh: row.album_name_zh ?? '',
          en: row.album_name_en ?? '',
          ja: row.album_name_ja ?? '',
          ko: row.album_name_ko ?? '',
          romanized: row.album_name_romanized ?? '',
        }
      : null,
    albumReleaseDate: row.album_release_date ?? null,
    coverLocal: row.album_cover_local ?? null,
    year: row.album_release_date ? Number(String(row.album_release_date).slice(0, 4)) : null,
    trackNo: row.track_no,
    durationSec: row.duration_sec,
    isTitle: Boolean(row.is_title),
    category: row.category,
    memberIds: parseJsonArray(row.member_ids_json),
    language: row.language,
    title: titles(row),
    note: notes(row),
    musicSquareQuery: row.music_square_query,
    musicSquarePreferred: row.music_square_preferred,
    neteaseSongId: row.netease_song_id ?? null,
    qqSongMid: row.qq_song_mid ?? null,
    kuwoRid: row.kuwo_rid ?? null,
    jooxSongMid: row.joox_song_mid ?? null,
    jooxSongId: row.joox_song_id ?? null,
    ytVideoId: row.yt_video_id ?? null,
    biliBvid: row.bili_bvid ?? null,
    biliPage: row.bili_page ? Number(row.bili_page) : null,
  }
}

export function mapMember(row: Row) {
  return {
    id: row.id,
    name: {
      zh: row.name_zh ?? '',
      en: row.name_en ?? '',
      ja: row.name_ja ?? '',
      ko: row.name_ko ?? '',
      romanized: row.name_romanized ?? '',
    },
    realName: {
      zh: row.real_name_zh ?? '',
      en: row.real_name_en ?? '',
      ja: row.real_name_ja ?? '',
      ko: row.real_name_ko ?? '',
    },
    birthday: row.birthday,
    heightCm: row.height_cm ? Number(row.height_cm) : null,
    bloodType: row.blood_type ?? null,
    mbti: row.mbti ?? null,
    zodiac: row.zodiac ?? null,
    debutDate: row.debut_date ?? null,
    nationality: row.nationality_code ? String(row.nationality_code).replace(/\s+/g, '').toLowerCase() : '',
    nationalityCode: row.nationality_code ? String(row.nationality_code).replace(/\s+/g, '').toLowerCase() : '',
    flagEmoji: row.flag_emoji,
    positions: parseJsonArray(row.position_json),
    colorHex: row.color_hex,
    photoLocal: row.photo_local ?? null,
    bio: {
      zh: row.bio_zh ?? '',
      en: row.bio_en ?? '',
      ja: row.bio_ja ?? '',
      ko: row.bio_ko ?? '',
    },
  }
}

export function listAlbums() {
  return getDatabase().prepare(`
    SELECT albums.*, COUNT(tracks.id) AS track_count
    FROM albums
    LEFT JOIN tracks ON tracks.album_id = albums.id
    GROUP BY albums.id
    ORDER BY albums.release_date DESC
  `).all().map((row) => mapAlbum(row as Row))
}

export function getAlbum(id: string) {
  const album = getDatabase().prepare(`
    SELECT albums.*, COUNT(tracks.id) AS track_count
    FROM albums
    LEFT JOIN tracks ON tracks.album_id = albums.id
    WHERE albums.id = ?
    GROUP BY albums.id
  `).get(id) as Row | undefined
  if (!album) return null

  return {
    ...mapAlbum(album),
    tracks: listTracks({ albumId: id }),
  }
}

export function listTracks(filters: { category?: string; year?: number; albumId?: string; q?: string } = {}) {
  const where: string[] = []
  const params: unknown[] = []

  if (filters.albumId) {
    where.push('tracks.album_id = ?')
    params.push(filters.albumId)
  }
  if (filters.category) {
    where.push('tracks.category = ?')
    params.push(filters.category)
  }
  if (filters.year) {
    where.push("strftime('%Y', albums.release_date) = ?")
    params.push(String(filters.year))
  }
  if (filters.q) {
    where.push(`(
      tracks.title_zh LIKE ? OR tracks.title_en LIKE ? OR tracks.title_ja LIKE ? OR
      tracks.title_ko LIKE ? OR tracks.title_romanized LIKE ? OR albums.name_en LIKE ?
    )`)
    const q = `%${filters.q}%`
    params.push(q, q, q, q, q, q)
  }

  return getDatabase().prepare(`
    SELECT
      tracks.*,
      albums.name_zh AS album_name_zh,
      albums.name_en AS album_name_en,
      albums.name_ja AS album_name_ja,
      albums.name_ko AS album_name_ko,
      albums.name_romanized AS album_name_romanized,
      albums.release_date AS album_release_date,
      albums.cover_local AS album_cover_local
    FROM tracks
    LEFT JOIN albums ON albums.id = tracks.album_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY COALESCE(albums.release_date, '9999-12-31') DESC, tracks.category, tracks.track_no
  `).all(...params).map((row) => mapTrack(row as Row))
}

export function getTrack(id: string) {
  const track = getDatabase().prepare(`
    SELECT
      tracks.*,
      albums.name_zh AS album_name_zh,
      albums.name_en AS album_name_en,
      albums.name_ja AS album_name_ja,
      albums.name_ko AS album_name_ko,
      albums.name_romanized AS album_name_romanized,
      albums.release_date AS album_release_date,
      albums.cover_local AS album_cover_local
    FROM tracks
    LEFT JOIN albums ON albums.id = tracks.album_id
    WHERE tracks.id = ?
  `).get(id) as Row | undefined

  return track ? mapTrack(track) : null
}

export function listMembers() {
  return getDatabase().prepare('SELECT * FROM members ORDER BY birthday').all().map((row) => mapMember(row as Row))
}

export function getMember(id: string) {
  const member = getDatabase().prepare('SELECT * FROM members WHERE id = ?').get(id) as Row | undefined
  if (!member) return null

  return {
    ...mapMember(member),
    tracks: listTracks().filter((track) => track.memberIds.includes(id)),
    covers: listCovers().filter((cover) => cover.performerMemberIds.includes(id)),
  }
}

export function listCfs() {
  return (getDatabase().prepare('SELECT * FROM cfs ORDER BY year DESC, brand').all() as Row[]).map((row) => ({
    id: row.id,
    brand: row.brand,
    year: row.year,
    country: row.country,
    memberIds: parseJsonArray(row.member_ids_json),
    title: titles(row as Row, 'song_'),
    description: {
      zh: row.desc_zh ?? '',
      en: row.desc_en ?? '',
      ja: row.desc_ja ?? '',
      ko: row.desc_ko ?? '',
    },
  }))
}

export function listCovers() {
  return (getDatabase().prepare('SELECT * FROM covers ORDER BY year DESC, performed_at').all() as Row[]).map((row) => ({
    id: row.id,
    performedAt: row.performed_at,
    isPredebut: Boolean(row.is_predebut),
    originalArtist: row.original_artist,
    originalSong: row.original_song,
    performerMemberIds: parseJsonArray(row.performer_member_ids_json),
    year: row.year,
    language: row.language,
    note: notes(row as Row),
  }))
}

const featuredAlbumIds = [
  'apple-twice-1840284138',
  'apple-twice-1813490993',
  'apple-twice-1828648304',
  'strategy',
  'ready-to-be',
  'formula-of-love',
  'eyes-wide-open',
  'fancy-you',
]

function isGroupAlbum(album: ReturnType<typeof mapAlbum>) {
  const albumId = String(album.id)
  return albumId.startsWith('apple-twice-') || (!albumId.startsWith('apple-') && album.type !== 'unit')
}

function featuredAlbums(albums: ReturnType<typeof mapAlbum>[]) {
  const picked = featuredAlbumIds
    .map((id) => albums.find((album) => album.id === id))
    .filter((album): album is ReturnType<typeof mapAlbum> => Boolean(album))
  const latestGroupAlbums = albums.filter((album) => isGroupAlbum(album) && !picked.some((item) => item.id === album.id))

  return [...picked, ...latestGroupAlbums].slice(0, 8)
}

export function getOverview() {
  const albums = listAlbums()
  const tracks = listTracks()
  const members = listMembers()
  const cfs = listCfs()
  const covers = listCovers()
  const years = Array.from(new Set([
    ...albums.map((album) => album.year),
    ...tracks.map((track) => track.year).filter((year): year is number => Boolean(year)),
    ...cfs.map((cf) => Number(cf.year)).filter(Boolean),
    ...covers.map((cover) => Number(cover.year)).filter(Boolean),
  ])).sort((a, b) => b - a)

  return {
    stats: {
      albums: albums.length,
      tracks: tracks.length,
      members: members.length,
      cfs: cfs.length,
      covers: covers.length,
      solos: tracks.filter((track) => track.category === 'solo').length,
      units: tracks.filter((track) => track.category === 'unit' || track.category === 'misamo').length,
    },
    years: years.map((year) => ({
      year,
      albums: albums.filter((album) => album.year === year),
      tracks: tracks.filter((track) => track.year === year),
      cfs: cfs.filter((cf) => Number(cf.year) === year),
      covers: covers.filter((cover) => Number(cover.year) === year),
    })),
    featuredAlbums: featuredAlbums(albums),
    featuredTracks: tracks.filter((track) => track.isTitle).slice(0, 8),
    categories: [
      { key: 'group', label: '团体歌曲', count: tracks.filter((track) => track.category === 'group').length },
      { key: 'solo', label: 'Solo', count: tracks.filter((track) => track.category === 'solo').length },
      { key: 'unit', label: '小分队', count: tracks.filter((track) => track.category === 'unit' || track.category === 'misamo').length },
      { key: 'cf', label: '广告歌曲', count: tracks.filter((track) => track.category === 'cf').length + cfs.length },
      { key: 'cover', label: '翻唱', count: tracks.filter((track) => track.category === 'cover' || track.category === 'predebut').length + covers.length },
    ],
  }
}

export function searchCatalog(q: string) {
  const needle = q.toLowerCase()
  const includes = (value: unknown) => String(value ?? '').toLowerCase().includes(needle)
  const normalize = (value: unknown) => String(value ?? '').toLowerCase().replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]+/g, '')
  const normalizedNeedle = normalize(q)
  const titleValues = (value: { title?: Record<string, unknown>; name?: Record<string, unknown> }) => Object.values(value.title ?? value.name ?? {})
  const titleScore = (values: unknown[]) => {
    const normalizedValues = values.map(normalize).filter(Boolean)
    if (normalizedValues.some((value) => value === normalizedNeedle)) return 0
    if (normalizedValues.some((value) => value.startsWith(normalizedNeedle))) return 1
    if (normalizedValues.some((value) => value.includes(normalizedNeedle))) return 2
    return 9
  }
  const sortByTitleMatch = <T extends { title: Record<string, unknown>; isTitle?: boolean }>(items: T[]) =>
    items.sort((a, b) => {
      const scoreA = titleScore(titleValues(a))
      const scoreB = titleScore(titleValues(b))
      if (scoreA !== scoreB) return scoreA - scoreB
      if (Boolean(a.isTitle) !== Boolean(b.isTitle)) return Number(Boolean(b.isTitle)) - Number(Boolean(a.isTitle))
      return 0
    })

  return {
    albums: sortByTitleMatch(listAlbums().filter((album) => Object.values(album.title).some(includes))),
    tracks: sortByTitleMatch(listTracks().filter((track) => Object.values(track.title).some(includes) || includes(track.albumTitle?.en))),
    members: listMembers().filter((member) => Object.values(member.name).some(includes) || Object.values(member.realName).some(includes)),
    cfs: listCfs().filter((cf) => includes(cf.brand) || Object.values(cf.title).some(includes)),
    covers: listCovers().filter((cover) => includes(cover.originalSong) || includes(cover.originalArtist)),
  }
}


