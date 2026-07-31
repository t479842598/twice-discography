import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getMvConfig, listHomeFeaturedMvs } from '../db/mv.js'
import {
  fetchBiliJson,
  getBiliCookie,
  resolveBiliMvPlayback,
  signStreamToken,
  USER_AGENT,
  verifyStreamToken,
} from '../services/biliCredential.js'
import type { BiliPlayData, BiliViewData } from '../services/biliCredential.js'

const STREAM_TOKEN_TOLERANCE_MS = 15_000
const STREAM_TOKEN_TTL_MS = 10 * 60 * 1000
const STREAM_MAX_REQUESTS_PER_MINUTE = 40
const streamBuckets = new Map<string, { count: number; resetAt: number }>()
// Cache resolved Bilibili target URLs per track+quality for 10 minutes.
const streamTargetCache = new Map<string, { targetUrl: string; expiresAt: number }>()

function resolveStreamTarget(trackId: string, qn: number, kind: string) {
  const key = `${trackId}:${qn}:${kind}`
  const cached = streamTargetCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.targetUrl
  return null
}

function cacheStreamTarget(trackId: string, qn: number, kind: string, targetUrl: string) {
  if (streamTargetCache.size > 500) streamTargetCache.clear()
  streamTargetCache.set(`${trackId}:${qn}:${kind}`, { targetUrl, expiresAt: Date.now() + STREAM_TOKEN_TTL_MS })
}

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
    const kind = query.kind === 'audio' ? 'audio' : 'video'
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
      let targetUrl = resolveStreamTarget(params.trackId, qn, kind)
      if (!targetUrl) {
        const view = await fetchBiliJson<BiliViewData>(
          `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
          cookie,
        )
        if (view.code !== 0 || !view.data) throw new Error(view.message || 'bili_view_failed')

        const cid = view.data.pages?.find((item) => item.page === page)?.cid ?? view.data.cid
        const playUrl = new URL('https://api.bilibili.com/x/player/playurl')
        playUrl.searchParams.set('bvid', bvid)
        playUrl.searchParams.set('cid', String(cid))
        playUrl.searchParams.set('qn', String(qn))
        playUrl.searchParams.set('fnval', '16')
        playUrl.searchParams.set('fnver', '0')
        playUrl.searchParams.set('fourk', '1')
        playUrl.searchParams.set('platform', 'web')

        const play = await fetchBiliJson<BiliPlayData>(playUrl.toString(), cookie)
        if (play.code !== 0 || !play.data) throw new Error(play.message || 'bili_playurl_failed')

        if (kind === 'audio') {
          const audio = (play.data.dash?.audio ?? [])[0]
          const audioUrl = audio?.baseUrl || audio?.base_url || null
          if (!audioUrl) throw new Error('bili_playurl_empty')
          targetUrl = audioUrl
        } else {
          const dashVideo = (play.data.dash?.video ?? []).find((item) => item.id === qn)
          targetUrl = (dashVideo?.baseUrl || dashVideo?.base_url) || play.data.durl?.[0]?.url || null
          if (!targetUrl) throw new Error('bili_playurl_empty')
        }
        cacheStreamTarget(params.trackId, qn, kind, targetUrl)
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
      reply.header('cache-control', 'private, max-age=3600')
      return reply.send(response.body)
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
    return reply.send(response.body)
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
