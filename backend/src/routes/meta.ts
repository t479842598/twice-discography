import type { FastifyInstance } from 'fastify'
import geoip from 'geoip-lite'
import { getOverview } from '../db/catalog.js'

const localeByCountry: Record<string, string> = {
  CN: 'zh-CN',
  TW: 'zh-CN',
  HK: 'zh-CN',
  MO: 'zh-CN',
  JP: 'ja-JP',
  KR: 'ko-KR',
}

function getClientIp(requestIp: string, forwardedFor?: string | string[]) {
  const header = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor
  const firstForwardedIp = header?.split(',')[0]?.trim()
  return firstForwardedIp || requestIp.replace('::ffff:', '')
}

export async function registerMetaRoutes(app: FastifyInstance) {
  app.get('/region-hint', async (request) => {
    const ip = getClientIp(request.ip, request.headers['x-forwarded-for'])
    const lookup = geoip.lookup(ip)
    const country = lookup?.country ?? 'UNKNOWN'
    const region = country === 'CN' || country === 'TW' || country === 'HK' || country === 'MO' ? 'CN' : 'GLOBAL'
    const suggestedLocale = localeByCountry[country] ?? 'en-US'

    return {
      ip,
      country,
      region,
      suggestedLocale,
    }
  })

  app.get('/languages', async () => ({
    defaultLocale: 'zh-CN',
    supported: ['zh-CN', 'en-US', 'ja-JP', 'ko-KR'],
  }))

  app.get('/stats', async () => getOverview().stats)
}
