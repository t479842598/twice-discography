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
const DEFAULT_ADMIN_PASSWORD = 'tang1234'

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
  return ensureAdminDefaults(() => hashPassword(process.env.ADMIN_DEFAULT_PASSWORD || DEFAULT_ADMIN_PASSWORD))
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

export function setAdminSessionCookie(reply: FastifyReply, sessionId: string, expiresAt: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  reply.header('set-cookie', `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax${secure}; Expires=${new Date(expiresAt).toUTCString()}`)
}

export function clearAdminSessionCookie(reply: FastifyReply) {
  reply.header('set-cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

export function getSessionId(request: FastifyRequest) {
  return parseCookies(request.headers.cookie).get(SESSION_COOKIE) || null
}

export function logoutAdmin(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = getSessionId(request)
  if (sessionId) deleteAdminSession(sessionId)
  clearAdminSessionCookie(reply)
}

export function getAdminFromRequest(request: FastifyRequest): AdminPrincipal | null {
  const sessionId = getSessionId(request)
  if (!sessionId) return null
  const user = findAdminSession(sessionId)
  if (!user || user.disabled) return null
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    roles: user.roles,
  }
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
