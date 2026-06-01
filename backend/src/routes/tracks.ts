import type { FastifyInstance } from 'fastify'
import { assetToMusicCandidate, findReadyMusicAsset } from '../db/musicAssets.js'
import { findMusicLyric, upsertMusicLyric } from '../db/musicLyrics.js'
import { getTrackMusicRecord } from '../db/tracks.js'
import type { MusicCandidate } from '../services/musicTypes.js'
import { withMusicCache } from '../services/musicCache.js'
import { getPlaybackCandidate, getTrackMusicCandidates } from '../services/musicProviders.js'
import { isR2MusicCacheBlocking, maybeCacheMusicCandidate } from '../services/musicR2Cache.js'
import { isMusicSource, parseQualityPreference, toPublicCandidate } from '../services/musicSelection.js'

const PLAYBACK_CACHE_TTL_MS = 10 * 60 * 1000

function getTrackOrReply(trackId: string) {
  return getTrackMusicRecord(trackId)
}

function withStoredLyric(candidate: MusicCandidate, trackId: string): MusicCandidate {
  if (candidate.lrc) {
    upsertMusicLyric({
      trackId,
      source: candidate.source,
      providerId: candidate.providerId,
      lrc: candidate.lrc,
    })
    return candidate
  }

  const cachedLyric = findMusicLyric(candidate.source, candidate.providerId)
  if (!cachedLyric?.lrc) return candidate

  return {
    ...candidate,
    lrc: cachedLyric.lrc,
    hasLyrics: true,
  }
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
    const cachedAsset = findReadyMusicAsset({ trackId: track.id, source, quality })

    if (cachedAsset) {
      const cachedCandidate = assetToMusicCandidate(cachedAsset, track)
      let selectedCandidate = withStoredLyric(cachedCandidate, track.id)
      let sourceOrder = track.musicSourceOrder ?? [cachedCandidate.source]
      let candidates = [selectedCandidate]

      if (!selectedCandidate.lrc) {
        try {
          const metadata = await withMusicCache(
            `track:cached-playback-meta:${track.id}:${cachedCandidate.source}:${quality}`,
            PLAYBACK_CACHE_TTL_MS,
            () => getPlaybackCandidate(track, {
              source: cachedCandidate.source,
              quality,
              jooxToken: process.env.JOOX_TOKEN,
            }),
          )
          sourceOrder = metadata.sourceOrder
          const metadataCandidate = metadata.selected ?? metadata.candidates.find((candidate) => candidate.source === cachedCandidate.source) ?? null

          if (metadataCandidate) {
            selectedCandidate = withStoredLyric({
              ...cachedCandidate,
              title: metadataCandidate.title || cachedCandidate.title,
              artist: metadataCandidate.artist || cachedCandidate.artist,
              album: metadataCandidate.album ?? cachedCandidate.album,
              coverUrl: metadataCandidate.coverUrl ?? cachedCandidate.coverUrl,
              durationSec: metadataCandidate.durationSec ?? cachedCandidate.durationSec,
              lrc: metadataCandidate.lrc ?? null,
              hasLyrics: Boolean(metadataCandidate.lrc || metadataCandidate.hasLyrics),
              pageUrl: metadataCandidate.pageUrl ?? cachedCandidate.pageUrl,
              selected: true,
            }, track.id)
            candidates = metadata.candidates.map((candidate) => (
              candidate.source === selectedCandidate.source && candidate.providerId === selectedCandidate.providerId
                ? selectedCandidate
                : withStoredLyric(candidate, track.id)
            ))
            if (!candidates.some((candidate) => candidate.source === selectedCandidate.source && candidate.providerId === selectedCandidate.providerId)) {
              candidates = [selectedCandidate, ...candidates]
            }
          }
        } catch {
          // Cached audio should remain playable even when live lyric metadata is unavailable.
        }
      }

      return {
        trackId: track.id,
        sourceOrder,
        selectedSource: selectedCandidate.source,
        recommendedSource: 'qq',
        selected: toPublicCandidate(selectedCandidate),
        audioUrl: cachedCandidate.audioUrl,
        lrc: selectedCandidate.lrc ?? null,
        lrcAvailable: Boolean(selectedCandidate.lrc),
        candidates: candidates.map(toPublicCandidate),
      }
    }

    const cacheKey = `track:playback:${track.id}:${source ?? 'auto'}:${quality}`
    const result = await withMusicCache(cacheKey, PLAYBACK_CACHE_TTL_MS, () => getPlaybackCandidate(track, {
      source,
      quality,
      jooxToken: process.env.JOOX_TOKEN,
    }))
    let selected = result.selected

    if (!selected?.audioUrl) {
      return reply.code(404).send({
        error: 'playback_not_available',
        source: source ?? 'auto',
        candidates: result.candidates.map(toPublicCandidate),
      })
    }

    selected = withStoredLyric(selected, track.id)
    const responseCandidates = result.candidates.map((candidate) => (
      candidate.source === selected.source && candidate.providerId === selected.providerId
        ? { ...candidate, lrc: selected.lrc, hasLyrics: Boolean(selected.lrc || selected.hasLyrics), selected: true }
        : withStoredLyric(candidate, track.id)
    ))

    let playbackUrl = selected.audioUrl
    if (isR2MusicCacheBlocking()) {
      const cachedAfterUpload = await maybeCacheMusicCandidate(selected, track)
      playbackUrl = cachedAfterUpload?.publicUrl ?? selected.audioUrl
    } else {
      maybeCacheMusicCandidate(selected, track)
    }

    return {
      trackId: track.id,
      sourceOrder: result.sourceOrder,
      selectedSource: selected.source,
      recommendedSource: 'qq',
      selected: toPublicCandidate({ ...selected, selected: true }),
      audioUrl: playbackUrl,
      lrc: selected.lrc ?? null,
      lrcAvailable: Boolean(selected.lrc),
      candidates: responseCandidates.map(toPublicCandidate),
    }
  })
}
