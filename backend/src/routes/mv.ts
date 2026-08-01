import type { FastifyInstance, FastifyRequest } from 'fastify'
import { Readable } from 'node:stream'
import { getMvConfig, listHomeFeaturedMvs } from '../db/mv.js'
import {
  getBiliCookie,
  resolveBiliMvPlayback,
  resolveBiliPlaybackData,
  signStreamToken,
  USER_AGENT,
  verifyStreamToken,
} from '../services/biliCredential.js'

const STREAM_TOKEN_TOLERANCE_MS = 15_000
const STREAM_TOKEN_TTL_MS = 10 * 60 * 1000
// DASH now fetches in 2MB Range chunks, so a single stream legitimately
// issues more requests than the old whole-file fetch. 120/min keeps a bound
// while allowing a few quality switches per minute per IP.
const STREAM_MAX_REQUESTS_PER_MINUTE = 120
const streamBuckets = new Map<string, { count: number; resetAt: number }>()

function isStreamAllowed(request: FastifyRequest) {
  const now = Date.now()
  if (streamBuckets.size > 1000) {
    for (const [key, bucket] of streamBuckets) {
      if (bucket.resetAt <= now) streamBuckets.delete(key)
    }
  }

  const ip = request.ip
  const bucket = streamBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    streamBuckets.set(ip, { count: 1, resetAt: now + 60_000 })
    return true
  }
  if (bucket.count >= STREAM_MAX_REQUESTS_PER_MINUTE) return false
  bucket.count += 1
  return true
}

function isAllowedCoverHost(hostname: string) {
  return hostname === 'hdslb.com' || hostname.endsWith('.hdslb.com')
}

function publicMv(mv: NonNullable<ReturnType<typeof getMvConfig>>) {
  return {
    trackId: mv.trackId,
    title: { zh: mv.titleZh ?? mv.trackId, en: mv.titleEn ?? mv.trackId },
    albumName: mv.albumName,
    biliBvid: mv.biliBvid ?? mv.fallbackBiliBvid,
    biliPage: mv.biliPage ?? mv.fallbackBiliPage ?? 1,
    ytVideoId: mv.fallbackYtVideoId,
    coverUrl: mv.coverUrl,
    aspectRatio: mv.aspectRatio,
    isHomeFeatured: mv.isHomeFeatured,
    sortOrder: mv.sortOrder,
    enabled: mv.enabled,
  }
}

export async function registerMvRoutes(app: FastifyInstance) {
  // ---- Built-in video stream proxy (signed URL, rate-limited) ----
  app.get('/:trackId/stream', async (request, reply) => {
    const params = request.params as { trackId: string }
    const query = request.query as { t?: string; exp?: string; qn?: string; kind?: string }
    const mv = getMvConfig(params.trackId)
    if (!mv || !mv.enabled) return reply.code(404).send({ error: 'mv_not_found' })

    const expiresAt = Number(query.exp ?? '0')
    const token = String(query.t ?? '')
    const qn = Number(query.qn ?? '64')
    // kind: 'video'|'audio' → DASH split streams; 'mp4' → the muxed durl MP4
    // (has an audio track) used by the MP4 fallback path.
    const kind = query.kind === 'audio' ? 'audio' : query.kind === 'mp4' ? 'mp4' : 'video'
    const now = Date.now()
    if (
      !Number.isFinite(expiresAt) ||
      !Number.isFinite(qn) ||
      now > expiresAt + STREAM_TOKEN_TOLERANCE_MS ||
      expiresAt > now + STREAM_TOKEN_TTL_MS + STREAM_TOKEN_TOLERANCE_MS ||
      !token ||
      !verifyStreamToken(params.trackId, qn, kind, expiresAt, token)
    ) {
      return reply.code(403).send({ error: 'invalid_stream_token' })
    }

    if (!isStreamAllowed(request)) {
      return reply.code(429).send({ error: 'stream_rate_limited' })
    }

    const bvid = mv.biliBvid || mv.fallbackBiliBvid
    const page = mv.biliPage || mv.fallbackBiliPage || 1
    if (!bvid) return reply.code(404).send({ error: 'mv_has_no_bili_video' })

    const cookie = getBiliCookie()
    if (!cookie) return reply.code(502).send({ error: 'bili_credential_not_configured' })

    try {
      let targetUrl: string | null = null
      if (kind === 'mp4') {
        // Muxed durl MP4 (video+audio in one file) for the fallback path.
        const mp4 = await resolveBiliPlaybackData(bvid, page, true, cookie)
        const durl = mp4.play.durl?.[0]?.url
        if (!durl) throw new Error('bili_playurl_empty')
        targetUrl = durl
      } else {
        // view+playurl resolution is TTL-cached (8 min) and shared with the
        // /playback route, so repeat streams do not re-hit the Bilibili API.
        const { play } = await resolveBiliPlaybackData(bvid, page, false, cookie)
        if (kind === 'audio') {
          const audio = (play.dash?.audio ?? [])[0]
          const audioUrl = audio?.baseUrl || audio?.base_url || null
          if (!audioUrl) throw new Error('bili_playurl_empty')
          targetUrl = audioUrl
        } else {
          const dashVideo = (play.dash?.video ?? []).find((item) => item.id === qn)
          targetUrl = (dashVideo?.baseUrl || dashVideo?.base_url) || play.durl?.[0]?.url || null
          if (!targetUrl) throw new Error('bili_playurl_empty')
        }
      }

      const range = request.headers.range
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15_000)
      let response: Response
      try {
        response = await fetch(targetUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: {
            referer: `https://www.bilibili.com/video/${bvid}`,
            'user-agent': USER_AGENT,
            ...(range ? { range } : {}),
          },
        })
      } finally {
        clearTimeout(timeout)
      }
      if (!response.ok || !response.body) {
        return reply.code(502).send({ error: 'bili_stream_failed' })
      }

      for (const header of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const value = response.headers.get(header)
        if (value) reply.header(header, value)
      }
      // The same signed stream URL is fetched with different Range headers
      // (DASH chunk fetching + native player seeks). The browser cache must
      // key on Range or every chunk after the first is served the cached
      // first 2MB — which breaks DASH parsing and silences the audio track.
      reply.header('cache-control', 'private, max-age=600')
      reply.header('vary', 'Range, Origin')
      const stream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
      stream.on('error', () => {
        // Client disconnected or upstream broke mid-stream; nothing to send.
      })
      return reply.send(stream)
    } catch (error) {
      return reply.code(502).send({
        error: 'bili_stream_failed',
        message: error instanceof Error ? error.message : String(error),
      })
    }
  })

  app.get('/cover-proxy', async (request, reply) => {
    const query = request.query as { url?: string }
    if (!query.url) return reply.code(400).send({ error: 'missing_url' })

    let target: URL
    try {
      target = new URL(query.url.replace(/^http:\/\//i, 'https://'))
    } catch {
      return reply.code(400).send({ error: 'invalid_url' })
    }

    if (target.protocol !== 'https:' || !isAllowedCoverHost(target.hostname)) {
      return reply.code(400).send({ error: 'invalid_cover_host' })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    let response: Response
    try {
      response = await fetch(target, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          referer: 'https://www.bilibili.com/',
          'user-agent': USER_AGENT,
        },
      })
    } finally {
      clearTimeout(timeout)
    }
    if (!response.ok || !response.body) return reply.code(502).send({ error: 'cover_fetch_failed' })

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    if (!contentType.toLowerCase().startsWith('image/')) {
      await response.body.cancel().catch(() => undefined)
      return reply.code(502).send({ error: 'invalid_cover_content_type' })
    }

    reply.header('content-type', contentType)
    reply.header('cache-control', 'public, max-age=86400')
    const stream = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream)
    stream.on('error', () => {
      // Client disconnected; nothing to send.
    })
    return reply.send(stream)
  })
  app.get('/home-featured', async () => ({ mvs: listHomeFeaturedMvs().filter((mv) => mv.enabled).map(publicMv) }))

  app.get('/:trackId', async (request, reply) => {
    const params = request.params as { trackId: string }
    const mv = getMvConfig(params.trackId)
    if (!mv) return reply.code(404).send({ error: 'mv_not_found' })
    return { mv: publicMv(mv) }
  })

  app.get('/:trackId/playback', async (request, reply) => {
    const params = request.params as { trackId: string }
    const query = request.query as { qn?: string; format?: string }
    const mv = getMvConfig(params.trackId)
    if (!mv || !mv.enabled) return reply.code(404).send({ error: 'mv_not_found' })
    const parsedQn = Number(query.qn)
    const playback = await resolveBiliMvPlayback(mv, {
      ...(Number.isFinite(parsedQn) ? { qn: parsedQn } : {}),
      ...(query.format === 'mp4' ? { format: 'mp4' as const } : {}),
    })
    if (!playback) return reply.code(404).send({ error: 'mv_playback_not_available' })
    return { trackId: params.trackId, ...playback }
  })
}
