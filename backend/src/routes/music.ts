import type { FastifyInstance } from 'fastify'
import { withMusicCache } from '../services/musicCache.js'
import { isMusicSource, parseQualityPreference, parseSourceList, toPublicCandidate } from '../services/musicSelection.js'
import { getPlaybackCandidate, resolveMusicSearchCandidate, searchMusicAcrossSources } from '../services/musicProviders.js'
import { MUSIC_SOURCE_LABELS } from '../services/musicTypes.js'

const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000

function parseLimit(value: unknown) {
  const limit = Number.parseInt(String(value ?? '10'), 10)
  if (!Number.isFinite(limit)) return 10

  return Math.min(Math.max(limit, 1), 30)
}

function interleaveMusicResults<T extends { source: string; displayIndex?: number }>(items: T[], sources: string[]) {
  const buckets = new Map(sources.map((source) => [source, items.filter((item) => item.source === source)]))
  const maxLength = Math.max(0, ...Array.from(buckets.values()).map((bucket) => bucket.length))
  const result: T[] = []

  for (let index = 0; index < maxLength; index += 1) {
    for (const source of sources) {
      const item = buckets.get(source)?.[index]
      if (item) result.push(item)
    }
  }

  return result.sort((left, right) => (left.displayIndex ?? 0) - (right.displayIndex ?? 0))
}

export async function registerMusicRoutes(app: FastifyInstance) {
  app.get('/search', async (request, reply) => {
    const query = request.query as { q?: string; sources?: string; limit?: string }
    const q = query.q?.trim()

    if (!q) {
      return reply.code(400).send({ error: 'missing_query', message: 'Query parameter q is required.' })
    }

    const sources = parseSourceList(query.sources)
    const limit = parseLimit(query.limit)
    const cacheKey = `music:search:${q}:${sources.join(',')}:${limit}`
    const hits = await withMusicCache(cacheKey, SEARCH_CACHE_TTL_MS, () => searchMusicAcrossSources(q, {
      sources,
      limit,
      jooxToken: process.env.JOOX_TOKEN,
    }))

    return {
      query: q,
      sources,
      limit,
      results: interleaveMusicResults(hits.map((hit) => ({
        ...hit,
        sourceName: MUSIC_SOURCE_LABELS[hit.source],
        quality: { tag: 'unknown', label: 'UNKNOWN', rank: 0, lossless: false },
        playable: false,
        recommended: hit.source === 'qq',
        selected: false,
        hasLyrics: Boolean(hit.hasLyrics),
        audioUrl: null,
        lrc: null,
      })), sources),
    }
  })

  app.get('/resolve', async (request, reply) => {
    const query = request.query as { q?: string; source?: string; providerId?: string; quality?: string }
    const q = query.q?.trim()
    const providerId = query.providerId?.trim()

    if (!q) {
      return reply.code(400).send({ error: 'missing_query', message: 'Query parameter q is required.' })
    }

    const source = query.source
    if (!source || !isMusicSource(source)) {
      return reply.code(400).send({ error: 'invalid_source', message: 'A valid source is required.' })
    }

    if (!providerId) {
      return reply.code(400).send({ error: 'missing_provider_id', message: 'Query parameter providerId is required.' })
    }

    const quality = parseQualityPreference(query.quality)
    const cacheKey = `music:resolve:v6:${q}:${source}:${providerId}:${quality}`
    const selected = await withMusicCache(cacheKey, SEARCH_CACHE_TTL_MS, async () => {
      const direct = await resolveMusicSearchCandidate(q, source, providerId, {
        quality,
        jooxToken: process.env.JOOX_TOKEN,
      })
      if (direct?.audioUrl) return direct

      const fallbackQuery = [direct?.title, direct?.artist].filter(Boolean).join(' ').trim() || q
      const fallback = await getPlaybackCandidate({
        id: `music-search:${source}:${providerId}`,
        titleZh: fallbackQuery,
        titleEn: fallbackQuery,
        musicSquareQuery: fallbackQuery,
      }, {
        quality,
        jooxToken: process.env.JOOX_TOKEN,
      })
      const playableFallbacks = fallback.candidates.filter((candidate) => candidate.playable && candidate.audioUrl)
      const normalizeText = (value?: string | null) => (value ?? '').trim().toLowerCase()
      const directTitle = normalizeText(direct?.title)
      const directArtist = normalizeText(direct?.artist)
      const titleAndArtistMatch = playableFallbacks.find((candidate) => (
        normalizeText(candidate.title) === directTitle &&
        Boolean(directArtist) &&
        normalizeText(candidate.artist).includes(directArtist)
      ))
      const titleMatch = playableFallbacks.find((candidate) => normalizeText(candidate.title) === directTitle)

      return titleAndArtistMatch ?? titleMatch ?? direct
    })

    if (!selected?.audioUrl) {
      return reply.code(404).send({
        error: 'music_not_available',
        message: 'Music audio URL is not available from the upstream provider or fallback sources.',
        source,
        providerId,
      })
    }

    return {
      query: q,
      source: selected.source,
      providerId: selected.providerId,
      selected: toPublicCandidate(selected),
      audioUrl: selected.audioUrl,
      lrc: selected.lrc ?? null,
      lrcAvailable: Boolean(selected.lrc),
    }
  })
}
