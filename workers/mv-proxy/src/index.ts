export interface Env {
  MV_PROXY_SIGNING_SECRET: string
}

const ALLOWED_METHODS = new Set(['GET', 'HEAD'])
const SIGNATURE_TOLERANCE_MS = 60_000

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!ALLOWED_METHODS.has(request.method)) {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, HEAD' } })
    }

    if (!env.MV_PROXY_SIGNING_SECRET) {
      return new Response('Proxy secret is not configured', { status: 500 })
    }

    const url = new URL(request.url)
    if (url.pathname !== '/mv-proxy') {
      return new Response('Not Found', { status: 404 })
    }

    const targetUrl = decodeBase64Url(url.searchParams.get('u'))
    const referer = decodeBase64Url(url.searchParams.get('r')) || 'https://www.bilibili.com'
    const expiresAt = Number(url.searchParams.get('exp') || '0')
    const signature = url.searchParams.get('sig') || ''

    if (!targetUrl || !signature || !Number.isFinite(expiresAt)) {
      return new Response('Invalid signed URL', { status: 403 })
    }

    if (Date.now() > expiresAt + SIGNATURE_TOLERANCE_MS) {
      return new Response('Signed URL expired', { status: 403 })
    }

    const expected = await sign(`${targetUrl}\n${referer}\n${expiresAt}`, env.MV_PROXY_SIGNING_SECRET)
    if (!timingSafeEqual(signature, expected)) {
      return new Response('Invalid signature', { status: 403 })
    }

    const target = new URL(targetUrl)
    if (!['http:', 'https:'].includes(target.protocol)) {
      return new Response('Invalid target URL', { status: 403 })
    }

    const upstreamHeaders = new Headers()
    const range = request.headers.get('range')
    if (range) upstreamHeaders.set('range', range)
    upstreamHeaders.set('accept', '*/*')
    upstreamHeaders.set('accept-encoding', 'identity')
    upstreamHeaders.set('referer', referer)
    upstreamHeaders.set('origin', new URL(referer).origin)
    upstreamHeaders.set('user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36')

    const upstream = await fetch(target.toString(), {
      method: request.method,
      headers: upstreamHeaders,
      redirect: 'follow',
    })

    const responseHeaders = new Headers()
    for (const header of [
      'accept-ranges',
      'cache-control',
      'content-length',
      'content-range',
      'content-type',
      'etag',
      'last-modified',
    ]) {
      const value = upstream.headers.get(header)
      if (value) responseHeaders.set(header, value)
    }
    responseHeaders.set('access-control-allow-origin', '*')
    responseHeaders.set('access-control-expose-headers', 'Accept-Ranges, Content-Length, Content-Range, Content-Type')
    responseHeaders.set('x-content-type-options', 'nosniff')

    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    })
  },
}

function decodeBase64Url(value: string | null): string {
  if (!value) return ''
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  try {
    return atob(padded)
  } catch {
    return ''
  }
}

function encodeBase64Url(bytes: ArrayBuffer): string {
  let binary = ''
  const data = new Uint8Array(bytes)
  for (const byte of data) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return encodeBase64Url(signature)
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}
