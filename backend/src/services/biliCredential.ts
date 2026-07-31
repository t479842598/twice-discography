import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes } from 'node:crypto'
import { getDatabase } from '../db/database.js'
import type { MvConfigRecord } from '../db/mv.js'

const CREDENTIAL_ID = 'default'
const ENCRYPTION_VERSION = 'bili-cookie-v2'
const KEY_DERIVATION_SALT = 'twice-discography/bili-credential'
const KEY_DERIVATION_INFO = 'aes-256-gcm/v2'
const MAX_COOKIE_BYTES = 64 * 1024
const REQUIRED_COOKIE_NAMES = ['SESSDATA'] as const
const VERIFY_URL = 'https://api.bilibili.com/x/web-interface/nav'
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36'

interface BiliCredentialRow {
  encryption_version?: string | null
  key_id?: string | null
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

function masterKey() {
  const configured = process.env.BILI_CREDENTIAL_ENCRYPTION_KEY?.trim() ?? ''
  if (!configured) throw new Error('missing_bili_credential_encryption_key')

  const unpadded = configured.replace(/=+$/, '')
  if (!/^[A-Za-z0-9+/_-]+$/.test(unpadded)) throw new Error('invalid_bili_credential_encryption_key')

  const key = Buffer.from(configured, 'base64')
  const canonicalBase64Url = key.toString('base64url')
  const canonicalBase64 = key.toString('base64')
  if (key.length !== 32 || (configured !== canonicalBase64 && unpadded !== canonicalBase64Url)) {
    throw new Error('invalid_bili_credential_encryption_key')
  }
  return key
}

function keyId(key = masterKey()) {
  return createHash('sha256').update(Buffer.concat([Buffer.from('bili-key-id\0'), key])).digest('base64url').slice(0, 22)
}

function encryptionKey(key = masterKey()) {
  return Buffer.from(hkdfSync(
    'sha256',
    key,
    Buffer.from(KEY_DERIVATION_SALT, 'utf8'),
    Buffer.from(KEY_DERIVATION_INFO, 'utf8'),
    32,
  ))
}

function encryptionAad(currentKeyId: string) {
  return Buffer.from(`${ENCRYPTION_VERSION}\0${CREDENTIAL_ID}\0${currentKeyId}`, 'utf8')
}

function normalizeCookieHeader(cookie: string) {
  const trimmed = cookie.trim()
  if (!trimmed || Buffer.byteLength(trimmed, 'utf8') > MAX_COOKIE_BYTES || /[\r\n\0]/.test(trimmed)) {
    throw new Error('invalid_bili_cookie')
  }

  const cookies = new Map<string, string>()
  for (const segment of trimmed.split(';')) {
    const item = segment.trim()
    const separator = item.indexOf('=')
    if (separator <= 0) continue
    const name = item.slice(0, separator).trim()
    const value = item.slice(separator + 1).trim()
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(name) || !value) continue
    cookies.set(name, value)
  }

  const missing = REQUIRED_COOKIE_NAMES.filter((name) => !cookies.has(name))
  if (missing.length) {
    throw new Error(`incomplete_bili_cookie:${missing.join(',')}`)
  }

  return Array.from(cookies, ([name, value]) => `${name}=${value}`).join('; ')
}

function encryptCookie(cookie: string) {
  const normalizedCookie = normalizeCookieHeader(cookie)
  const currentKeyId = keyId()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  cipher.setAAD(encryptionAad(currentKeyId))
  const encrypted = Buffer.concat([cipher.update(normalizedCookie, 'utf8'), cipher.final()])
  return {
    encryptionVersion: ENCRYPTION_VERSION,
    keyId: currentKeyId,
    encryptedCookie: encrypted.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: cipher.getAuthTag().toString('base64url'),
  }
}

function decryptCookie(row: BiliCredentialRow) {
  if (row.encryption_version !== ENCRYPTION_VERSION || !row.key_id) {
    throw new Error('legacy_bili_credential')
  }
  if (row.key_id !== keyId()) throw new Error('bili_credential_key_mismatch')

  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(row.iv, 'base64url'))
    decipher.setAAD(encryptionAad(row.key_id))
    decipher.setAuthTag(Buffer.from(row.auth_tag, 'base64url'))
    const cookie = Buffer.concat([
      decipher.update(Buffer.from(row.encrypted_cookie, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return normalizeCookieHeader(cookie)
  } catch (error) {
    if (error instanceof Error && ['invalid_bili_cookie', 'incomplete_bili_cookie'].includes(error.message)) throw error
    throw new Error('bili_credential_decryption_failed', { cause: error })
  }
}

export function saveBiliCredential(cookie: string) {
  const encrypted = encryptCookie(cookie)
  const now = Date.now()
  getDatabase().prepare(`
    INSERT INTO bili_credentials (
      id, encryption_version, key_id, encrypted_cookie, iv, auth_tag, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      encryption_version = excluded.encryption_version,
      key_id = excluded.key_id,
      encrypted_cookie = excluded.encrypted_cookie,
      iv = excluded.iv,
      auth_tag = excluded.auth_tag,
      updated_at = excluded.updated_at,
      last_verified_at = NULL,
      last_verify_status = NULL,
      last_verify_message = NULL
  `).run(
    CREDENTIAL_ID,
    encrypted.encryptionVersion,
    encrypted.keyId,
    encrypted.encryptedCookie,
    encrypted.iv,
    encrypted.authTag,
    now,
    now,
  )
}

export function deleteBiliCredential() {
  return getDatabase().prepare('DELETE FROM bili_credentials WHERE id = ?').run(CREDENTIAL_ID).changes > 0
}

export function getBiliCredentialStatus() {
  const row = getDatabase().prepare(`
    SELECT encryption_version, key_id, encrypted_cookie, iv, auth_tag,
           last_verified_at, last_verify_status, last_verify_message
    FROM bili_credentials WHERE id = ?
  `).get(CREDENTIAL_ID) as BiliCredentialRow | undefined

  let usable = false
  let problem: string | null = null
  if (row) {
    try {
      usable = Boolean(decryptCookie(row).trim())
      if (!usable) problem = 'bili_credential_empty'
    } catch (error) {
      problem = error instanceof Error ? error.message : 'bili_credential_decryption_failed'
    }
  }

  return {
    configured: Boolean(row),
    encryptionVersion: row?.encryption_version ?? null,
    usable,
    problem,
    lastVerifiedAt: row?.last_verified_at ?? null,
    lastVerifyStatus: row?.last_verify_status ?? null,
    lastVerifyMessage: row?.last_verify_message ?? null,
  }
}

export function getBiliCookie() {
  const row = getDatabase().prepare(`
    SELECT encryption_version, key_id, encrypted_cookie, iv, auth_tag
    FROM bili_credentials WHERE id = ?
  `).get(CREDENTIAL_ID) as BiliCredentialRow | undefined
  if (!row) return null
  try {
    return decryptCookie(row)
  } catch {
    return null
  }
}

function updateVerifyStatus(status: string, message: string) {
  getDatabase().prepare(`
    UPDATE bili_credentials
    SET last_verified_at = ?, last_verify_status = ?, last_verify_message = ?, updated_at = ?
    WHERE id = ?
  `).run(Date.now(), status, message.slice(0, 500), Date.now(), CREDENTIAL_ID)
}

export async function fetchBiliJson<T>(url: string, cookie: string): Promise<BiliApiResponse<T>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        cookie,
        referer: 'https://www.bilibili.com/',
        'user-agent': USER_AGENT,
      },
    })
    if (!response.ok) throw new Error(`bili_http_${response.status}`)
    return await response.json() as BiliApiResponse<T>
  } finally {
    clearTimeout(timeout)
  }
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
  const credentialStatus = getBiliCredentialStatus()
  const cookie = getBiliCookie()
  if (!cookie) {
    return {
      configured: credentialStatus.configured,
      profile: null,
      message: credentialStatus.problem || 'B站凭证未配置',
    }
  }

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
  const credentialStatus = getBiliCredentialStatus()
  const cookie = getBiliCookie()
  if (!cookie) {
    const message = credentialStatus.problem || 'B站凭证未配置'
    if (credentialStatus.configured) updateVerifyStatus('failed', message)
    return { ok: false, message }
  }

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
  if (!secret || !base || !allowedOrigin) return null
  const endpoint = base.endsWith('/mv-proxy') ? base : `${base}/mv-proxy`
  const version = 'v1'
  const payload = `${version}\n${targetUrl}\n${referer}\n${expiresAt}\n${allowedOrigin}`
  const sig = createHmac('sha256', secret).update(payload).digest('base64url')
  const params = new URLSearchParams({ v: version, u: b64url(targetUrl), r: b64url(referer), exp: String(expiresAt), o: b64url(allowedOrigin), sig })
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
  const credentialStatus = getBiliCredentialStatus()
  const cookie = getBiliCookie()
  if (!cookie) {
    return {
      source: 'bilibili-iframe' as const,
      quality: null,
      videoUrl: null,
      expiresAt: null,
      fallbackIframeUrl,
      message: credentialStatus.problem || 'B站凭证未配置',
    }
  }

  try {
    const view = await fetchBiliJson<BiliViewData>(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`, cookie)
    if (view.code !== 0 || !view.data) throw new Error(view.message || 'bili_view_failed')
    const cid = view.data.pages?.find((item) => item.page === page)?.cid ?? view.data.cid
    const playUrl = new URL('https://api.bilibili.com/x/player/playurl')
    playUrl.searchParams.set('bvid', bvid)
    playUrl.searchParams.set('cid', String(cid))
    playUrl.searchParams.set('qn', '120')
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
    if (!externalProxyUrl) {
      return {
        source: 'bilibili-iframe' as const,
        quality: play.data.quality ?? null,
        videoUrl: null,
        expiresAt: null,
        fallbackIframeUrl,
        message: 'mv_proxy_not_configured',
      }
    }

    return {
      source: 'bilibili-proxy' as const,
      quality: play.data.quality ?? null,
      videoUrl: externalProxyUrl,
      expiresAt,
      fallbackIframeUrl,
      message: 'ok',
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
