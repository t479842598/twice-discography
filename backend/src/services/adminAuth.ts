import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import type { FastifyReply, FastifyRequest } from 'fastify'
import {
  type AdminRole,
  createAdminSession,
  deleteAdminSession,
  ensureAdminDefaults,
  findAdminSession,
  getAdminPasswordHash,
  pruneExpiredAdminSessions,
} from '../db/admin.js'

const scrypt = promisify(scryptCallback)
const SESSION_COOKIE = 'twice_admin_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const MIN_BOOTSTRAP_PASSWORD_LENGTH = 12

export interface AdminPrincipal {
  id: string
  email: string
  displayName: string
  roles: AdminRole[]
}

export function publicAdminUser(user: AdminPrincipal) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, 64) as Buffer
  return `scrypt$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function verifyPassword(password: string, passwordHash: string) {
  const [scheme, saltText, hashText] = passwordHash.split('$')
  if (scheme !== 'scrypt' || !saltText || !hashText) return false
  const salt = Buffer.from(saltText, 'base64url')
  const expected = Buffer.from(hashText, 'base64url')
  const actual = await scrypt(password, salt, expected.length) as Buffer
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export async function ensureDefaultAdmin() {
  return ensureAdminDefaults(() => {
    const password = process.env.ADMIN_DEFAULT_PASSWORD?.trim() ?? ''
    if (password.length < MIN_BOOTSTRAP_PASSWORD_LENGTH) {
      throw new Error('ADMIN_DEFAULT_PASSWORD must be set to at least 12 characters before creating the first administrator')
    }
    return hashPassword(password)
  })
}

export async function loginAdmin(email: string, password: string) {
  const passwordHash = getAdminPasswordHash(email)
  if (!passwordHash) return null
  if (!(await verifyPassword(password, passwordHash))) return null

  const { findAdminUserByEmail } = await import('../db/admin.js')
  const user = findAdminUserByEmail(email)
  if (!user || user.disabled) return null

  pruneExpiredAdminSessions()
  const session = createAdminSession(user.id, SESSION_TTL_MS)
  return { user, session }
}

export function parseCookies(header?: string) {
  const cookies = new Map<string, string>()
  if (!header) return cookies
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index <= 0) continue
    cookies.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()))
  }
  return cookies
}

function hasHttpsFrontendOrigin() {
  const origins = [process.env.FRONTEND_ORIGIN, process.env.CORS_ORIGIN]
    .flatMap((value) => value?.split(',') ?? [])
    .map((value) => value.trim())
    .filter(Boolean)

  return origins.some((origin) => {
    try {
      const url = new URL(origin)
      return url.protocol === 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1'
    } catch {
      return false
    }
  })
}

function trustedAdminOrigins() {
  const configured = [process.env.FRONTEND_ORIGIN, process.env.CORS_ORIGIN]
    .flatMap((value) => value?.split(',') ?? [])
    .flatMap((value) => {
      try {
        return [new URL(value.trim()).origin]
      } catch {
        return []
      }
    })
  if (process.env.NODE_ENV !== 'production') {
    configured.push('http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000')
  }
  return new Set(configured)
}

function adminCookieAttributes() {
  if (process.env.NODE_ENV === 'production' || process.env.RENDER || hasHttpsFrontendOrigin()) {
    return 'Path=/; HttpOnly; SameSite=None; Secure'
  }
  return 'Path=/; HttpOnly; SameSite=Lax'
}

export function setAdminSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: number) {
  reply.header('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; ${adminCookieAttributes()}; Expires=${new Date(expiresAt).toUTCString()}`)
}

export function clearAdminSessionCookie(reply: FastifyReply) {
  reply.header('set-cookie', `${SESSION_COOKIE}=; ${adminCookieAttributes()}; Max-Age=0`)
}

export function getSessionId(request: FastifyRequest) {
  return parseCookies(request.headers.cookie).get(SESSION_COOKIE) || null
}

export function logoutAdmin(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionId(request)
  if (sessionId) deleteAdminSession(sessionId)
  clearAdminSessionCookie(reply)
}

export function getAdminSession(request: FastifyRequest) {
  const sessionId = getSessionId(request)
  if (!sessionId) return null
  const session = findAdminSession(sessionId)
  if (!session || session.user.disabled) return null
  return {
    sessionId,
    csrfToken: session.csrfToken,
    user: {
      id: session.user.id,
      email: session.user.email,
      displayName: session.user.displayName,
      roles: session.user.roles,
    } satisfies AdminPrincipal,
  }
}

export function getAdminFromRequest(request: FastifyRequest): AdminPrincipal | null {
  return getAdminSession(request)?.user ?? null
}

export function requireAdminCsrf(request: FastifyRequest, reply: FastifyReply) {
  const origin = request.headers.origin
  if (origin && !trustedAdminOrigins().has(origin)) {
    reply.code(403).send({ error: 'invalid_origin' })
    return null
  }

  const session = getAdminSession(request)
  if (!session) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }

  const supplied = String(request.headers['x-csrf-token'] ?? '')
  const suppliedBuffer = Buffer.from(supplied)
  const expectedBuffer = Buffer.from(session.csrfToken)
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) {
    reply.code(403).send({ error: 'invalid_csrf_token' })
    return null
  }

  return session.user
}

export function hasRole(user: AdminPrincipal, roles: AdminRole[]) {
  return user.roles.includes('owner') || roles.some((role) => user.roles.includes(role))
}

export function requireAdmin(request: FastifyRequest, reply: FastifyReply, roles: AdminRole[] = ['owner', 'admin', 'editor']) {
  const user = getAdminFromRequest(request)
  if (!user) {
    reply.code(401).send({ error: 'unauthorized' })
    return null
  }
  if (!hasRole(user, roles)) {
    reply.code(403).send({ error: 'forbidden' })
    return null
  }
  return user
}
