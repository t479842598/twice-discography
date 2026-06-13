import type { FastifyInstance } from 'fastify'
import { getMvConfig, listHomeFeaturedMvs } from '../db/mv.js'
import {
  resolveBiliMvPlayback,
  getBiliCookie,
  fetchBiliJson,
  USER_AGENT,
} from '../services/biliCredential.js'
import type { BiliViewData, BiliPlayData } from '../services/biliCredential.js'


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

  // ---- Video stream proxy (built-in, no external worker needed) ----
  app.get('/:trackId/stream', async (request, reply) => {
    const params = request.params as { trackId: string }
    const mv = getMvConfig(params.trackId)
    if (!mv || !mv.enabled) return reply.code(404).send({ error: 'mv_not_found' })

    const bvid = mv.biliBvid || mv.fallbackBiliBvid
    const page = mv.biliPage || mv.fallbackBiliPage || 1
    if (!bvid) return reply.code(404).send({ error: 'mv_has_no_bili_video' })

    const cookie = getBiliCookie()
    if (!cookie) return reply.code(502).send({ error: 'bili_credential_not_configured' })

    try {
      const view = await fetchBiliJson<BiliViewData>(
        `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
        cookie,
      )
      if (view.code !== 0 || !view.data) throw new Error(view.message || 'bili_view_failed')

      const cid = view.data.pages?.find((item) => item.page === page)?.cid ?? view.data.cid
      const playUrl = new URL('https://api.bilibili.com/x/player/playurl')
      playUrl.searchParams.set('bvid', bvid)
      playUrl.searchParams.set('cid', String(cid))
      playUrl.searchParams.set('qn', '80')
      playUrl.searchParams.set('fnval', '0')
      playUrl.searchParams.set('fourk', '1')
      playUrl.searchParams.set('platform', 'web')

      const play = await fetchBiliJson<BiliPlayData>(playUrl.toString(), cookie)
      if (play.code !== 0 || !play.data) throw new Error(play.message || 'bili_playurl_failed')

      const targetUrl = play.data.durl?.[0]?.url ??
        play.data.dash?.video?.find((v) => v.baseUrl || v.base_url)?.baseUrl ??
        play.data.dash?.video?.find((v) => v.baseUrl || v.base_url)?.base_url
      if (!targetUrl) throw new Error('bili_playurl_empty')

      // Stream the video through our backend with the correct Referer
      const response = await fetch(targetUrl, {
        headers: {
          referer: `https://www.bilibili.com/video/${bvid}`,
          'user-agent': USER_AGENT,
        },
      })
      if (!response.ok || !response.body) {
        return reply.code(502).send({ error: 'bili_stream_failed' })
      }

      const contentType = response.headers.get('content-type') || 'video/mp4'
      const contentLength = response.headers.get('content-length')
      reply.header('content-type', contentType)
      if (contentLength) reply.header('content-length', contentLength)
      reply.header('cache-control', 'public, max-age=3600')
      reply.header('access-control-allow-origin', '*')
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

    const response = await fetch(target, {
      headers: {
        referer: 'https://www.bilibili.com/',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      },
    })
    if (!response.ok || !response.body) return reply.code(502).send({ error: 'cover_fetch_failed' })

    reply.header('content-type', response.headers.get('content-type') || 'image/jpeg')
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
    const mv = getMvConfig(params.trackId)
    if (!mv || !mv.enabled) return reply.code(404).send({ error: 'mv_not_found' })
    const playback = await resolveBiliMvPlayback(mv)
    if (!playback) return reply.code(404).send({ error: 'mv_playback_not_available' })
    return { trackId: params.trackId, ...playback }
  })
}
