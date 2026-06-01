import type { FastifyInstance } from 'fastify'
import { getMvConfig, listHomeFeaturedMvs } from '../db/mv.js'
import { resolveBiliMvPlayback } from '../services/biliCredential.js'


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
