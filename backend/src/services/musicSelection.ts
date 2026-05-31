import {
  MUSIC_SOURCE_LABELS,
  MUSIC_SOURCE_ORDER,
  type MusicCandidate,
  type MusicQuality,
  type MusicSource,
  type PublicMusicCandidate,
  type QualityTag,
} from './musicTypes.js'

const QUALITY_RANKS: Record<QualityTag, number> = {
  lossless: 50,
  '320k': 40,
  hq: 30,
  standard: 20,
  low: 10,
  unknown: 0,
}

export function isMusicSource(value: string): value is MusicSource {
  return (MUSIC_SOURCE_ORDER as readonly string[]).includes(value)
}

export function parseSourceList(value?: string | null): MusicSource[] {
  if (!value) return [...MUSIC_SOURCE_ORDER]

  const sources = value
    .split(',')
    .map((source) => source.trim().toLowerCase())
    .filter(isMusicSource)

  return sources.length ? Array.from(new Set(sources)) : [...MUSIC_SOURCE_ORDER]
}

export function normalizeSourceOrder(value?: MusicSource[] | null): MusicSource[] {
  const normalized = (value ?? []).filter(isMusicSource)

  // 如果提供了自定义音源列表，只使用这些音源，不自动补全
  if (normalized.length > 0) {
    return Array.from(new Set(normalized))
  }

  // 如果没有提供，使用默认的所有音源
  return [...MUSIC_SOURCE_ORDER]
}

export function sourcePriority(source: MusicSource, sourceOrder: MusicSource[] = MUSIC_SOURCE_ORDER as unknown as MusicSource[]) {
  const index = normalizeSourceOrder(sourceOrder).indexOf(source)
  return index === -1 ? MUSIC_SOURCE_ORDER.length : index
}

export function normalizeQuality(input: {
  tag?: QualityTag | string | null
  label?: string | null
  bitrateKbps?: number | null
  text?: string | null
  url?: string | null
}): MusicQuality {
  const text = `${input.tag ?? ''} ${input.label ?? ''} ${input.text ?? ''} ${input.url ?? ''}`.toLowerCase()
  let tag: QualityTag = 'unknown'

  if (/lossless|flac|hi-res|hires|sq|pq|zp|无损|母带|全景声/.test(text) || (input.bitrateKbps ?? 0) >= 900) {
    tag = 'lossless'
  } else if (/320|exhigh/.test(text) || (input.bitrateKbps ?? 0) >= 320) {
    tag = '320k'
  } else if (/hq|高音质|192/.test(text) || (input.bitrateKbps ?? 0) >= 192) {
    tag = 'hq'
  } else if (/standard|std|128|m4a|mp3|ogg|mpeg|audio/.test(text) || (input.bitrateKbps ?? 0) >= 128) {
    tag = 'standard'
  } else if (/low|fq|96|48/.test(text) || (input.bitrateKbps ?? 0) > 0) {
    tag = 'low'
  }

  const labelByTag: Record<QualityTag, string> = {
    lossless: 'LOSSLESS',
    '320k': '320K',
    hq: 'HQ',
    standard: 'STD',
    low: 'LOW',
    unknown: 'UNKNOWN',
  }

  return {
    tag,
    label: input.label?.trim() || labelByTag[tag],
    rank: QUALITY_RANKS[tag],
    lossless: tag === 'lossless',
    bitrateKbps: input.bitrateKbps ?? undefined,
    text: input.text ?? undefined,
  }
}

export function sortCandidatesForDisplay(candidates: MusicCandidate[], sourceOrder: MusicSource[] = [...MUSIC_SOURCE_ORDER]) {
  const order = normalizeSourceOrder(sourceOrder)

  return [...candidates].sort((left, right) => {
    const sourceDelta = sourcePriority(left.source, order) - sourcePriority(right.source, order)
    if (sourceDelta !== 0) return sourceDelta

    const playableDelta = Number(right.playable) - Number(left.playable)
    if (playableDelta !== 0) return playableDelta

    return (left.displayIndex ?? 0) - (right.displayIndex ?? 0)
  })
}

export function selectDefaultCandidate(candidates: MusicCandidate[], sourceOrder: MusicSource[] = [...MUSIC_SOURCE_ORDER]) {
  const playable = candidates.filter((candidate) => candidate.playable && candidate.audioUrl)
  const order = normalizeSourceOrder(sourceOrder)

  return [...playable].sort((left, right) => {
    const qualityDelta = right.quality.rank - left.quality.rank
    if (qualityDelta !== 0) return qualityDelta

    return sourcePriority(left.source, order) - sourcePriority(right.source, order)
  })[0] ?? null
}

export function markCandidateSelection(candidates: MusicCandidate[], selected: MusicCandidate | null) {
  return candidates.map((candidate) => ({
    ...candidate,
    recommended: candidate.source === 'qq',
    selected: Boolean(
      selected &&
        candidate.source === selected.source &&
        candidate.providerId === selected.providerId,
    ),
  }))
}

export function toPublicCandidate(candidate: MusicCandidate): PublicMusicCandidate {
  return {
    source: candidate.source,
    sourceName: candidate.sourceName || MUSIC_SOURCE_LABELS[candidate.source],
    providerId: candidate.providerId,
    title: candidate.title,
    artist: candidate.artist,
    album: candidate.album,
    coverUrl: candidate.coverUrl,
    durationSec: candidate.durationSec,
    quality: candidate.quality,
    playable: candidate.playable,
    recommended: candidate.recommended,
    selected: candidate.selected,
    hasLyrics: candidate.hasLyrics,
    pageUrl: candidate.pageUrl,
    failureReason: candidate.failureReason,
  }
}

export function parseQualityPreference(value?: string | null): QualityTag | 'best' {
  if (!value) return 'best'
  const normalized = value.toLowerCase()

  return normalized === 'best' || normalized in QUALITY_RANKS ? (normalized as QualityTag | 'best') : 'best'
}
