import type { FastifyInstance } from 'fastify'
import { getTrackMusicRecord } from '../db/tracks.js'
import { withMusicCache } from '../services/musicCache.js'
import { getPlaybackCandidate, getTrackMusicCandidates } from '../services/musicProviders.js'
import { isMusicSource, parseQualityPreference, toPublicCandidate } from '../services/musicSelection.js'

const PLAYBACK_CACHE_TTL_MS = 10 * 60 * 1000

function getTrackOrReply(trackId: string) {
  return getTrackMusicRecord(trackId)
}

export async function registerTrackRoutes(app: FastifyInstance) {
  app.get('/:id/music-candidates', async (request, reply) => {
    const params = request.params as { id: string }
    const track = getTrackOrReply(params.id)

    if (!track) {
      return reply.code(404).send({ error: 'track_not_found' })
    }

    const cacheKey = `track:music-candidates:${track.id}`
    const result = await withMusicCache(cacheKey, PLAYBACK_CACHE_TTL_MS, () => getTrackMusicCandidates(track, {
      jooxToken: process.env.JOOX_TOKEN,
    }))

    return {
      trackId: track.id,
      sourceOrder: result.sourceOrder,
      selectedSource: result.selected?.source ?? null,
      recommendedSource: 'qq',
      candidates: result.candidates.map(toPublicCandidate),
    }
  })

  app.get('/:id/playback', async (request, reply) => {
    const params = request.params as { id: string }
    const query = request.query as { source?: string; quality?: string }
    const track = getTrackOrReply(params.id)

    if (!track) {
      return reply.code(404).send({ error: 'track_not_found' })
    }

    const source = query.source && isMusicSource(query.source) ? query.source : null
    const quality = parseQualityPreference(query.quality)
    const cacheKey = `track:playback:${track.id}:${source ?? 'auto'}:${quality}`
    const result = await withMusicCache(cacheKey, PLAYBACK_CACHE_TTL_MS, () => getPlaybackCandidate(track, {
      source,
      quality,
      jooxToken: process.env.JOOX_TOKEN,
    }))
    const selected = result.selected

    if (!selected?.audioUrl) {
      return reply.code(404).send({
        error: 'playback_not_available',
        source: source ?? 'auto',
        candidates: result.candidates.map(toPublicCandidate),
      })
    }

    return {
      trackId: track.id,
      sourceOrder: result.sourceOrder,
      selectedSource: selected.source,
      recommendedSource: 'qq',
      selected: toPublicCandidate({ ...selected, selected: true }),
      audioUrl: selected.audioUrl,
      lrc: selected.lrc ?? null,
      lrcAvailable: Boolean(selected.lrc),
      candidates: result.candidates.map(toPublicCandidate),
    }
  })
}
