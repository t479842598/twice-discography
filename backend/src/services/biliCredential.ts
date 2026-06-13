import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { getDatabase } from '../db/database.js'
import type { MvConfigRecord } from '../db/mv.js'

const CREDENTIAL_ID = 'default'
const VERIFY_URL = 'https://api.bilibili.com/x/web-interface/nav'
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36'

interface BiliCredentialRow {
  encrypted_cookie: string
  iv: string
  auth_tag: string
  last_verified_at?: number | null
  last_verify_status?: string | null
  last_verify_message?: string | null
}

interface BiliApiResponse<T> {
  code: number
  message: string
  data?: T
}

export interface BiliViewData {
  cid: number
  bvid?: string
  pic?: string
  title?: string
  pages?: Array<{ page: number; cid: number; part?: string }>
}

interface BiliNavData {
  isLogin?: boolean
  uname?: string
  mid?: number
  face?: string
  level_info?: { current_level?: number }
  vipStatus?: number
  vipType?: number
  pendant?: { name?: string; image?: string }
  official?: { title?: string; desc?: string; role?: number; type?: number }
  follower?: number
  following?: number
  dynamic?: number
}

export interface BiliPlayData {
  quality?: number
  accept_quality?: number[]
  durl?: Array<{ url: string; size?: number }>
  dash?: { video?: Array<{ baseUrl?: string; base_url?: string; id?: number }> }
}

function encryptionKey() {
  const configured = process.env.BILI_CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (!configured) throw new Error('missing_bili_credential_encryption_key')
  if (/^[A-Za-z0-9_-]{43,44}$/.test(configured)) {
    const key = Buffer.from(configured, 'base64url')
    if (key.length === 32) return key
  }
  return createHash('sha256').update(configured).digest()
}

function encryptCookie(cookie: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(cookie, 'utf8'), cipher.final()])
  return {
    encryptedCookie: encrypted.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  }
}

function decryptCookie(row: BiliCredentialRow) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(row.encrypted_cookie, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function saveBiliCredential(cookie: string) {
  const encrypted = encryptCookie(cookie.trim())
  const now = Date.now()
  getDatabase().prepare(`
    INSERT INTO bili_credentials (id, encrypted_cookie, iv, auth_tag, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      encrypted_cookie = excluded.encrypted_cookie,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      updated_at = excluded.updated_at,
      last_verify_status = NULL,
      last_verify_message = NULL
  `).run(CREDENTIAL_ID, encrypted.encryptedCookie, encrypted.iv, encrypted.authTag, now, now)
}

export function getBiliCredentialStatus() {
  const row = getDatabase().prepare(`
    SELECT last_verified_at, last_verify_status, last_verify_message
    FROM bili_credentials WHERE id = ?
  `).get(CREDENTIAL_ID) as BiliCredentialRow | undefined
  return {
    configured: Boolean(row),
    lastVerifiedAt: row?.last_verified_at ?? null,
    lastVerifyStatus: row?.last_verify_status ?? null,
    lastVerifyMessage: row?.last_verify_message ?? null,
  }
}

export function getBiliCookie() {
  const row = getDatabase().prepare('SELECT encrypted_cookie, iv, auth_tag FROM bili_credentials WHERE id = ?').get(CREDENTIAL_ID) as BiliCredentialRow | undefined
  return row ? decryptCookie(row) : null
}

function updateVerifyStatus(status: string, message: string) {
  getDatabase().prepare(`
    UPDATE bili_credentials
    SET last_verified_at = ?, last_verify_status = ?, last_verify_message = ?, updated_at = ?
    WHERE id = ?
  `).run(Date.now(), status, message.slice(0, 500), Date.now(), CREDENTIAL_ID)
}

export async function fetchBiliJson<T>(url: string, cookie: string): Promise<BiliApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      cookie,
      referer: 'https://www.bilibili.com/',
      'user-agent': USER_AGENT,
    },
  })
  if (!response.ok) throw new Error(`bili_http_${response.status}`)
  return await response.json() as BiliApiResponse<T>
}

function toHttpsUrl(value?: string | null) {
  if (!value) return null
  if (value.startsWith('//')) return `https:${value}`
  return value.replace(/^http:\/\//i, 'https://')
}

export function extractBiliVideoRef(input: string) {
  const text = input.trim()
  const bvid = text.match(/BV[a-zA-Z0-9]{10}/)?.[0] ?? null
  let page = 1

  try {
    const url = new URL(text)
    const pageText = url.searchParams.get('p')
    if (pageText && Number.isFinite(Number(pageText))) page = Math.max(1, Number(pageText))
  } catch {
    const pageText = text.match(/[?&]p=(\d+)/)?.[1]
    if (pageText) page = Math.max(1, Number(pageText))
  }

  return bvid ? { bvid, page } : null
}

export async function resolveBiliVideoMeta(input: string) {
  const ref = extractBiliVideoRef(input)
  if (!ref) throw new Error('invalid_bili_url')
  const cookie = getBiliCookie() ?? ''
  const view = await fetchBiliJson<BiliViewData>(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(ref.bvid)}`, cookie)
  if (view.code !== 0 || !view.data) throw new Error(view.message || 'bili_view_failed')
  return {
    biliBvid: view.data.bvid || ref.bvid,
    biliPage: ref.page,
    coverUrl: toHttpsUrl(view.data.pic),
    title: view.data.title ?? null,
    pages: view.data.pages?.map((page) => ({ page: page.page, cid: page.cid, part: page.part ?? null })) ?? [],
  }
}

export async function getBiliProfile() {
  const cookie = getBiliCookie()
  if (!cookie) return { configured: false, profile: null, message: 'B站凭证未配置' }

  const result = await fetchBiliJson<BiliNavData>(VERIFY_URL, cookie)
  if (result.code !== 0 || !result.data?.isLogin) {
    return { configured: true, profile: null, message: result.message || 'B站登录态不可用' }
  }

  const data = result.data
  return {
    configured: true,
    profile: {
      mid: data.mid ?? null,
      uname: data.uname || 'B站账号',
      face: toHttpsUrl(data.face),
      level: data.level_info?.current_level ?? null,
      vipStatus: data.vipStatus ?? null,
      vipType: data.vipType ?? null,
      pendantName: data.pendant?.name ?? null,
      pendantImage: toHttpsUrl(data.pendant?.image),
      officialTitle: data.official?.title || data.official?.desc || null,
      follower: data.follower ?? null,
      following: data.following ?? null,
      dynamic: data.dynamic ?? null,
    },
    message: 'ok',
  }
}

export async function verifyBiliCredential() {
  const cookie = getBiliCookie()
  if (!cookie) return { ok: false, message: 'B站凭证未配置' }

  try {
    const result = await fetchBiliJson<BiliNavData>(VERIFY_URL, cookie)
    const ok = result.code === 0 && Boolean(result.data?.isLogin)
    const message = ok
      ? `已登录：${result.data?.uname || 'B站账号'}，VIP 状态：${result.data?.vipStatus ? '可用' : '未知/未开通'}`
      : result.message || 'B站登录态不可用'
    updateVerifyStatus(ok ? 'ok' : 'failed', message)
    return { ok, message }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    updateVerifyStatus('failed', message)
    return { ok: false, message }
  }
}

function b64url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function signProxyUrl(targetUrl: string, referer: string, expiresAt: number, allowedOrigin: string) {
  const secret = process.env.MV_PROXY_SIGNING_SECRET?.trim()
  const base = process.env.MV_PROXY_BASE_URL?.trim()?.replace(/\/+$/, '')
  if (!secret || !base) return null
  const endpoint = base.endsWith('/mv-proxy') ? base : `${base}/mv-proxy`
  const payload = `${targetUrl}\n${referer}\n${expiresAt}\n${allowedOrigin}`
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  const params = new URLSearchParams({ u: b64url(targetUrl), r: b64url(referer), exp: String(expiresAt), o: b64url(allowedOrigin), sig })
  return `${endpoint}?${params.toString()}`
}

function iframeUrl(bvid: string, page: number) {
  const params = new URLSearchParams({ bvid, page: String(page), autoplay: '1', high_quality: '1', danmaku: '0', as_wide: '1' })
  return `https://player.bilibili.com/player.html?${params.toString()}`
}

export async function resolveBiliMvPlayback(mv: MvConfigRecord) {
  const bvid = mv.biliBvid || mv.fallbackBiliBvid
  const page = mv.biliPage || mv.fallbackBiliPage || 1
  if (!bvid || !mv.enabled) return null

  const fallbackIframeUrl = iframeUrl(bvid, page)
  const cookie = getBiliCookie()
  if (!cookie) {
    return { source: 'bilibili-iframe' as const, quality: null, videoUrl: null, expiresAt: null, fallbackIframeUrl, message: 'B站凭证未配置' }
  }

  try {
    const view = await fetchBiliJson<BiliViewData>(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, cookie)
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
    const referer = `https://www.bilibili.com/video/${bvid}`
    const expiresAt = Date.now() + 10 * 60 * 1000
    const allowedOrigin = process.env.FRONTEND_ORIGIN?.split(',')[0]?.trim() || process.env.CORS_ORIGIN?.split(',')[0]?.trim() || ''
    const externalProxyUrl = signProxyUrl(targetUrl, referer, expiresAt, allowedOrigin)
    // When no external MV proxy is configured, stream through our own backend
    const videoUrl = externalProxyUrl ?? `/api/mv/${encodeURIComponent(mv.trackId)}/stream`

    return {
      source: 'bilibili-proxy' as const,
      quality: play.data.quality ?? null,
      videoUrl,
      expiresAt,
      fallbackIframeUrl,
      message: externalProxyUrl ? 'ok' : 'mv_proxy_not_configured',
    }
  } catch (error) {
    return {
      source: 'bilibili-iframe' as const,
      quality: null,
      videoUrl: null,
      expiresAt: null,
      fallbackIframeUrl,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
