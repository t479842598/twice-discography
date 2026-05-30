import type { FastifyInstance } from 'fastify'
import { withMusicCache } from '../services/musicCache.js'
import { parseSourceList, sortCandidatesForDisplay } from '../services/musicSelection.js'
import { searchMusicAcrossSources } from '../services/musicProviders.js'
import { MUSIC_SOURCE_LABELS } from '../services/musicTypes.js'

const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000

function parseLimit(value: unknown) {
  const limit = Number.parseInt(String(value ?? '10'), 10)
  if (!Number.isFinite(limit)) return 10

  return Math.min(Math.max(limit, 1), 30)
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
      results: sortCandidatesForDisplay(hits.map((hit) => ({
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
}
