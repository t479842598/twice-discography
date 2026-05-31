import {
  MUSIC_SOURCE_LABELS,
  MUSIC_SOURCE_ORDER,
  type MusicCandidate,
  type MusicProviderOptions,
  type MusicSearchHit,
  type MusicSearchOptions,
  type MusicSource,
  type QualityTag,
  type TrackMusicRecord,
} from './musicTypes.js'
import {
  normalizeQuality,
  normalizeSourceOrder,
  parseQualityPreference,
  selectDefaultCandidate,
  sortCandidatesForDisplay,
} from './musicSelection.js'

const DEFAULT_TIMEOUT_MS = 8000
const DEFAULT_SEARCH_LIMIT = 10

type JsonValue = Record<string, unknown> | unknown[]

function getFetch(options?: MusicProviderOptions) {
  return options?.fetcher ?? fetch
}

async function requestText(url: string, options?: MusicProviderOptions, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await getFetch(options)(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
    })

    if (!response.ok && response.status !== 206) {
      throw new Error(`HTTP ${response.status}`)
    }

    return response.text()
  } finally {
    clearTimeout(timeout)
  }
}

async function requestOk(url: string, options?: MusicProviderOptions, init?: RequestInit) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    const response = await getFetch(options)(url, {
      ...init,
      signal: controller.signal,
      redirect: 'follow',
    })

    await response.body?.cancel().catch(() => undefined)

    return response.ok || response.status === 206 || (response.status >= 200 && response.status < 400)
  } finally {
    clearTimeout(timeout)
  }
}

async function requestJson<T extends JsonValue>(url: string, options?: MusicProviderOptions) {
  const text = await requestText(url, options)
  return JSON.parse(text) as T
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function numberValue(value: unknown) {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  return undefined
}

function toHttpsUrl(value: unknown) {
  const url = stringValue(value).trim()
  if (!url) return null

  return url.replace(/^http:/i, 'https:')
}

function pickQueryParam(rawUrl: unknown, key: string) {
  const value = stringValue(rawUrl)
  if (!value) return ''

  try {
    return new URL(value).searchParams.get(key) ?? ''
  } catch {
    const match = value.match(new RegExp(`[?&]${key}=([^&]+)`))
    return match ? decodeURIComponent(match[1]) : ''
  }
}

function buildSearchQuery(track: TrackMusicRecord) {
  return (
    track.musicSquareQuery?.trim() ||
    [track.titleEn || track.titleZh, 'TWICE'].filter(Boolean).join(' ').trim()
  )
}

function candidateBase(hit: MusicSearchHit, patch: Partial<MusicCandidate> = {}): MusicCandidate {
  const audioUrl = patch.audioUrl ?? null
  const lrc = patch.lrc ?? null

  return {
    ...hit,
    sourceName: MUSIC_SOURCE_LABELS[hit.source],
    quality: patch.quality ?? normalizeQuality({ url: audioUrl, text: 'standard mp3' }),
    playable: Boolean(audioUrl),
    recommended: hit.source === 'qq',
    selected: false,
    hasLyrics: Boolean(lrc || hit.hasLyrics),
    audioUrl,
    lrc,
    pageUrl: patch.pageUrl ?? null,
    failureReason: patch.failureReason ?? null,
  }
}

function scoreHit(hit: MusicSearchHit, track: TrackMusicRecord) {
  const haystack = `${hit.title} ${hit.artist} ${hit.album ?? ''}`.toLowerCase()
  const titles = [track.titleEn, track.titleZh, track.titleJa, track.titleKo, track.titleRomanized]
    .filter(Boolean)
    .map((title) => String(title).toLowerCase())
  let score = 0

  for (const title of titles) {
    if (title && hit.title.toLowerCase() === title) score += 30
    else if (title && haystack.includes(title)) score += 12
  }

  if (/twice|트와이스/.test(haystack)) score += 15
  if (track.albumName && haystack.includes(track.albumName.toLowerCase())) score += 8
  if (track.durationSec && hit.durationSec) {
    const delta = Math.abs(track.durationSec - hit.durationSec)
    if (delta <= 2) score += 8
    else if (delta <= 6) score += 4
  }
  if (/(instrumental|karaoke|伴奏|纯音乐|off vocal)/i.test(haystack) && !/(instrumental|karaoke|伴奏|纯音乐|off vocal)/i.test(titles.join(' '))) {
    score -= 80
  }

  score -= hit.displayIndex ?? 0
  return score
}

function chooseBestHit(hits: MusicSearchHit[], track: TrackMusicRecord) {
  return [...hits].sort((left, right) => scoreHit(right, track) - scoreHit(left, track))[0] ?? null
}

interface AudioVariant {
  url: string | null
  tag?: QualityTag
  label?: string
  bitrateKbps?: number
  text?: string
}

function pickAudioVariant(variants: AudioVariant[], qualityPreference?: QualityTag | 'best') {
  const normalized = variants
    .filter((variant) => variant.url)
    .map((variant) => ({
      ...variant,
      quality: normalizeQuality({
        tag: variant.tag,
        label: variant.label,
        bitrateKbps: variant.bitrateKbps,
        text: variant.text,
        url: variant.url,
      }),
    }))

  if (!normalized.length) return null

  if (!qualityPreference || qualityPreference === 'best') {
    return normalized.sort((left, right) => right.quality.rank - left.quality.rank)[0]
  }

  const requested = normalizeQuality({ tag: qualityPreference }).rank
  const exact = normalized.find((variant) => variant.quality.tag === qualityPreference)
  if (exact) return exact

  return normalized
    .filter((variant) => variant.quality.rank <= requested)
    .sort((left, right) => right.quality.rank - left.quality.rank)[0] ?? normalized[0]
}

export async function searchNetease(query: string, options?: MusicSearchOptions): Promise<MusicSearchHit[]> {
  const limit = Math.max(1, options?.limit ?? DEFAULT_SEARCH_LIMIT)
  const url = `https://api.qijieya.cn/meting/?type=search&id=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}&server=netease`
  const json = await requestJson<unknown[]>(url, options)

  return Array.isArray(json)
    ? json.map((item, index) => {
        const record = item as Record<string, unknown>
        const providerId = pickQueryParam(record.url, 'id') || `${query}-${index + 1}`

      return {
          source: 'netease' as const,
          providerId,
          title: stringValue(record.name),
          artist: stringValue(record.artist),
          album: null,
          coverUrl: toHttpsUrl(record.pic),
          displayIndex: index + 1,
          hasLyrics: Boolean(record.lrc),
          metadata: {
            audioUrl: toHttpsUrl(record.url),
            lrcUrl: toHttpsUrl(record.lrc),
          },
        }
      })
    : []
}

export async function searchQQ(query: string, options?: MusicSearchOptions): Promise<MusicSearchHit[]> {
  const url = `https://tang.api.s01s.cn/music_open_api.php?msg=${encodeURIComponent(query)}&type=json`
  const json = await requestJson<JsonValue>(url, options)
  const list = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>)?.data)
      ? ((json as Record<string, unknown>).data as unknown[])
      : []

  return list.slice(0, options?.limit ?? DEFAULT_SEARCH_LIMIT).flatMap((item, index) => {
    const record = item as Record<string, unknown>
    const providerId = stringValue(record.song_mid)
    if (!providerId) return []

    return [{
      source: 'qq' as const,
      providerId,
      title: stringValue(record.song_title),
      artist: stringValue(record.singer_name),
      album: null,
      coverUrl: null,
      displayIndex: index + 1,
      hasLyrics: false,
      metadata: {
        pay: record.pay,
        searchKey: query,
      },
    }]
  })
}

export async function searchKuwo(query: string, options?: MusicSearchOptions): Promise<MusicSearchHit[]> {
  const limit = Math.max(1, options?.limit ?? DEFAULT_SEARCH_LIMIT)
  const url = `https://kw-api.cenguigui.cn/?name=${encodeURIComponent(query)}&page=1&limit=${encodeURIComponent(limit)}`
  const json = await requestJson<Record<string, unknown>>(url, options)
  const list = Array.isArray(json.data) ? json.data : []

  return list.map((item, index) => {
    const record = item as Record<string, unknown>

    return {
      source: 'kuwo' as const,
      providerId: String(record.rid ?? ''),
      title: stringValue(record.name),
      artist: stringValue(record.artist),
      album: stringValue(record.album) || null,
      coverUrl: toHttpsUrl(record.pic),
      displayIndex: index + 1,
      hasLyrics: Boolean(record.lrc),
      metadata: {
        audioUrl: toHttpsUrl(record.url),
        lrcUrl: toHttpsUrl(record.lrc),
      },
    }
  }).filter((hit) => hit.providerId)
}

export async function searchJoox(query: string, options?: MusicSearchOptions): Promise<MusicSearchHit[]> {
  const token = options?.jooxToken ?? process.env.JOOX_TOKEN
  if (!token) return []

  const url = `https://apicx.asia/api/joox_music?msg=${encodeURIComponent(query)}&token=${encodeURIComponent(token)}&br=4`
  const json = await requestJson<Record<string, unknown>>(url, options)
  const data = json.data as Record<string, unknown> | undefined
  const list = Array.isArray(data?.songs) ? data.songs : []

  return list.slice(0, options?.limit ?? DEFAULT_SEARCH_LIMIT).map((item, index) => {
    const record = item as Record<string, unknown>
    const songMid = stringValue(record.songmid)
    const songId = stringValue(record['歌曲ID'])

    return {
      source: 'joox' as const,
      providerId: songMid || songId || `${query}-${index + 1}`,
      title: stringValue(record['歌曲名称']),
      artist: stringValue(record['歌手']),
      album: stringValue(record['专辑']) || null,
      coverUrl: null,
      durationSec: parseDuration(stringValue(record['时长'])),
      displayIndex: index + 1,
      hasLyrics: Boolean(record['歌词内容']),
      metadata: {
        songMid,
        songId,
        lrc: stringValue(record['歌词内容']) || null,
      },
    }
  })
}

function parseDuration(value: string) {
  const match = value.match(/^(\d+):(\d{2})$/)
  if (!match) return undefined

  return Number(match[1]) * 60 + Number(match[2])
}

export async function searchMusicAcrossSources(query: string, options?: MusicSearchOptions): Promise<MusicSearchHit[]> {
  const sources = normalizeSourceOrder(options?.sources ?? [...MUSIC_SOURCE_ORDER])
  const tasks = sources.map(async (source) => {
    if (source === 'qq') return searchQQ(query, options)
    if (source === 'netease') return searchNetease(query, options)
    if (source === 'kuwo') return searchKuwo(query, options)
    return searchJoox(query, options)
  })
  const results = await Promise.allSettled(tasks)

  return results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
}

export async function resolveNeteaseCandidate(track: TrackMusicRecord, options?: MusicProviderOptions): Promise<MusicCandidate | null> {
  const query = buildSearchQuery(track)
  let songId = track.neteaseSongId ?? ''
  let searchHit: MusicSearchHit | null = null

  if (!songId) {
    searchHit = chooseBestHit(await searchNetease(query, { ...options, limit: 5 }), track)
    songId = searchHit?.providerId ?? ''
  }

  if (!songId) return null

  const audioUrl = `https://api.qijieya.cn/meting/?server=netease&type=url&id=${encodeURIComponent(songId)}`
  const lrcUrl = `https://api.qijieya.cn/meting/?server=netease&type=lrc&id=${encodeURIComponent(songId)}`
  let lrc: string | null = null

  try {
    lrc = await requestText(lrcUrl, options)
  } catch {
    lrc = null
  }

  return candidateBase(searchHit ?? {
    source: 'netease',
    providerId: songId,
    title: track.titleEn || track.titleZh,
    artist: 'TWICE',
    album: track.albumName,
    durationSec: track.durationSec,
  }, {
    audioUrl,
    lrc,
    quality: normalizeQuality({ tag: 'standard', label: 'STD', text: 'netease mp3' }),
  })
}

export async function resolveQQCandidate(track: TrackMusicRecord, options?: MusicProviderOptions): Promise<MusicCandidate | null> {
  const query = buildSearchQuery(track)
  let mid = track.qqSongMid ?? ''
  let searchHit: MusicSearchHit | null = null

  if (!mid) {
    searchHit = chooseBestHit(await searchQQ(query, { ...options, limit: 8 }), track)
    mid = searchHit?.providerId ?? ''
  }

  if (!mid) return null

  const url = `https://tang.api.s01s.cn/music_open_api.php?msg=${encodeURIComponent(query)}&type=json&mid=${encodeURIComponent(mid)}`
  const detail = await requestJson<Record<string, unknown>>(url, options)
  if (!detail.song_mid) return null

  const qualityPreference = parseQualityPreference(options?.quality)
  const variant = pickAudioVariant([
    { url: toHttpsUrl(detail.song_play_url_sq), tag: 'lossless', label: 'LOSSLESS', bitrateKbps: numberValue(detail.kbps_sq), text: `SQ ${detail.kbps_sq ?? ''}` },
    { url: toHttpsUrl(detail.song_play_url_pq), tag: 'lossless', label: 'LOSSLESS', bitrateKbps: numberValue(detail.kbps_pq), text: `PQ ${detail.kbps_pq ?? ''}` },
    { url: toHttpsUrl(detail.song_play_url_hq), tag: 'hq', label: 'HQ', bitrateKbps: numberValue(detail.kbps_hq), text: `HQ ${detail.kbps_hq ?? ''}` },
    { url: toHttpsUrl(detail.song_play_url_standard), tag: 'standard', label: 'STD', bitrateKbps: numberValue(detail.kbps_standard), text: `STD ${detail.kbps_standard ?? ''}` },
    { url: toHttpsUrl(detail.song_play_url_fq), tag: 'low', label: 'LOW', bitrateKbps: numberValue(detail.kbps_fq), text: `FQ ${detail.kbps_fq ?? ''}` },
    { url: toHttpsUrl(detail.song_play_url), tag: 'standard', label: 'STD', bitrateKbps: numberValue(detail.kbps), text: `STD ${detail.kbps ?? ''}` },
  ], qualityPreference)

  return candidateBase(searchHit ?? {
    source: 'qq',
    providerId: stringValue(detail.song_mid) || mid,
    title: stringValue(detail.song_title) || stringValue(detail.song_name) || track.titleEn || track.titleZh,
    artist: stringValue(detail.singer_name) || 'TWICE',
    album: stringValue(detail.album_name) || stringValue(detail.album_title) || track.albumName,
    coverUrl: toHttpsUrl(detail.album_pic) ?? toHttpsUrl(detail.singer_pic),
    durationSec: numberValue(detail.song_play_time) ?? track.durationSec,
  }, {
    audioUrl: variant?.url ?? null,
    lrc: stringValue(detail.song_lyric) || stringValue(detail.lyric) || null,
    quality: variant?.quality ?? normalizeQuality({ tag: 'unknown' }),
    pageUrl: toHttpsUrl(detail.song_h5_url),
  })
}

function qualityLevelForKuwo(preference?: QualityTag | 'best') {
  if (!preference || preference === 'best' || preference === 'lossless') return 'zp'
  if (preference === '320k' || preference === 'hq') return 'exhigh'

  return 'standard'
}

export async function resolveKuwoCandidate(track: TrackMusicRecord, options?: MusicProviderOptions): Promise<MusicCandidate | null> {
  const query = buildSearchQuery(track)
  let rid = track.kuwoRid ?? ''
  let searchHit: MusicSearchHit | null = null

  if (!rid) {
    searchHit = chooseBestHit(await searchKuwo(query, { ...options, limit: 5 }), track)
    rid = searchHit?.providerId ?? ''
  }

  if (!rid) return null

  const qualityPreference = parseQualityPreference(options?.quality)
  const level = qualityLevelForKuwo(qualityPreference)
  const url = `https://kw-api.cenguigui.cn/?id=${encodeURIComponent(rid)}&type=song&level=${encodeURIComponent(level)}&format=json`
  const json = await requestJson<Record<string, unknown>>(url, options)
  const detail = json.data as Record<string, unknown> | undefined
  if (!detail) return null

  const audioUrl = toHttpsUrl(detail.url)
  const quality = normalizeQuality({
    bitrateKbps: numberValue(detail.bitrate),
    text: stringValue(detail.quality),
    url: audioUrl,
  })

  return candidateBase(searchHit ?? {
    source: 'kuwo',
    providerId: String(detail.rid ?? rid),
    title: stringValue(detail.name) || track.titleEn || track.titleZh,
    artist: stringValue(detail.artist) || 'TWICE',
    album: stringValue(detail.album) || track.albumName,
    coverUrl: toHttpsUrl(detail.pic),
    durationSec: numberValue(detail.duration) ?? track.durationSec,
  }, {
    audioUrl,
    lrc: stringValue(detail.lyric) || null,
    quality,
  })
}

export async function resolveJooxCandidate(track: TrackMusicRecord, options?: MusicProviderOptions): Promise<MusicCandidate | null> {
  const token = options?.jooxToken ?? process.env.JOOX_TOKEN
  if (!token) return null

  const query = buildSearchQuery(track)
  const hits = await searchJoox(query, { ...options, jooxToken: token, limit: 12 })
  const target = hits.find((hit) => {
    const metadata = hit.metadata ?? {}
    return (
      (track.jooxSongMid && metadata.songMid === track.jooxSongMid) ||
      (track.jooxSongId && metadata.songId === track.jooxSongId)
    )
  }) ?? chooseBestHit(hits, track)

  if (!target) return null

  const n = target.displayIndex ?? 1
  const url = `https://apicx.asia/api/joox_music?msg=${encodeURIComponent(query)}&n=${encodeURIComponent(n)}&token=${encodeURIComponent(token)}&br=4`
  const json = await requestJson<Record<string, unknown>>(url, options)
  const detail = json.data as Record<string, unknown> | undefined
  if (!detail) return null

  const links = detail['播放链接'] as Record<string, unknown> | undefined
  const qualityPreference = parseQualityPreference(options?.quality)
  const variant = pickAudioVariant([
    { url: toHttpsUrl(links?.['Atmos全景声']), tag: 'lossless', label: 'LOSSLESS', text: 'Atmos全景声' },
    { url: toHttpsUrl(links?.['母带无损']), tag: 'lossless', label: 'LOSSLESS', text: '母带无损' },
    { url: toHttpsUrl(links?.['Hi-Res无损']), tag: 'lossless', label: 'LOSSLESS', text: 'Hi-Res无损' },
    { url: toHttpsUrl(links?.['无损FLAC']), tag: 'lossless', label: 'LOSSLESS', text: '无损FLAC' },
    { url: toHttpsUrl(links?.['OGG 320']), tag: '320k', label: '320K', text: 'OGG 320' },
    { url: toHttpsUrl(links?.['MP3 320']), tag: '320k', label: '320K', text: 'MP3 320' },
    { url: toHttpsUrl(links?.['AAC 192']), tag: 'hq', label: 'HQ', text: 'AAC 192' },
    { url: toHttpsUrl(links?.['OGG 192']), tag: 'hq', label: 'HQ', text: 'OGG 192' },
    { url: toHttpsUrl(links?.['MP3 128']), tag: 'standard', label: 'STD', text: 'MP3 128' },
    { url: toHttpsUrl(links?.['AAC 96']), tag: 'low', label: 'LOW', text: 'AAC 96' },
    { url: toHttpsUrl(links?.['AAC 48']), tag: 'low', label: 'LOW', text: 'AAC 48' },
  ], qualityPreference)

  return candidateBase({
    ...target,
    providerId: stringValue(detail.songmid) || stringValue(detail['歌曲ID']) || target.providerId,
    title: stringValue(detail['歌曲名称']) || target.title,
    artist: stringValue(detail['歌手']) || target.artist,
    album: stringValue(detail['专辑']) || target.album,
    durationSec: parseDuration(stringValue(detail['时长'])) ?? target.durationSec,
  }, {
    audioUrl: variant?.url ?? null,
    lrc: stringValue(detail['歌词内容']) || stringValue(target.metadata?.lrc) || null,
    quality: variant?.quality ?? normalizeQuality({ tag: 'unknown' }),
  })
}

async function probeAudioUrl(audioUrl: string, options?: MusicProviderOptions) {
  try {
    if (await requestOk(audioUrl, options, { method: 'HEAD' })) return true
  } catch {
    // Some music CDNs reject HEAD. Fall back to a tiny ranged GET below.
  }

  try {
    return requestOk(audioUrl, options, { method: 'GET', headers: { Range: 'bytes=0-0' } })
  } catch {
    return false
  }
}

async function verifyCandidate(candidate: MusicCandidate, options?: MusicProviderOptions) {
  if (!candidate.audioUrl) {
    return { ...candidate, playable: false, failureReason: 'missing_audio_url' }
  }

  const playable = await probeAudioUrl(candidate.audioUrl, {
    ...options,
    timeoutMs: Math.min(options?.timeoutMs ?? 3000, 3000),
  })

  return {
    ...candidate,
    playable,
    failureReason: playable ? null : 'audio_url_unreachable',
  }
}

export async function getTrackMusicCandidates(track: TrackMusicRecord, options?: MusicProviderOptions) {
  const sourceOrder = normalizeSourceOrder(track.musicSourceOrder ?? [...MUSIC_SOURCE_ORDER])

  const resolverMap: Record<MusicSource, (track: TrackMusicRecord, options?: MusicProviderOptions) => Promise<MusicCandidate | null>> = {
    qq: resolveQQCandidate,
    netease: resolveNeteaseCandidate,
    kuwo: resolveKuwoCandidate,
    joox: resolveJooxCandidate,
  }

  const resolvers = sourceOrder.map((source) => resolverMap[source])
  const settled = await Promise.allSettled(resolvers.map((resolver) => resolver(track, options)))
  const candidates = settled.flatMap((result) => (
    result.status === 'fulfilled' && result.value ? [result.value] : []
  ))
  const verified = await Promise.all(candidates.map((candidate) => verifyCandidate(candidate, options)))
  const selected = selectDefaultCandidate(verified, sourceOrder)
  const marked = verified.map((candidate) => ({
    ...candidate,
    recommended: candidate.source === 'qq',
    selected: Boolean(selected && candidate.source === selected.source && candidate.providerId === selected.providerId),
  }))

  return {
    sourceOrder,
    selected,
    candidates: sortCandidatesForDisplay(marked, sourceOrder),
  }
}

export async function getPlaybackCandidate(
  track: TrackMusicRecord,
  options?: MusicProviderOptions & { source?: MusicSource | null },
) {
  const { sourceOrder, candidates } = await getTrackMusicCandidates(track, options)
  const selected = options?.source
    ? candidates.find((candidate) => candidate.source === options.source && candidate.playable && candidate.audioUrl) ?? null
    : selectDefaultCandidate(candidates, sourceOrder)

  return {
    sourceOrder,
    selected,
    candidates: candidates.map((candidate) => ({
      ...candidate,
      selected: Boolean(selected && candidate.source === selected.source && candidate.providerId === selected.providerId),
    })),
  }
}
