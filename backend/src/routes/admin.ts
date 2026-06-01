import type { FastifyInstance } from 'fastify'
import { createAdminRole, createAdminUser, deleteAdminRole, listAdminRoles, listAdminUsers, normalizeAdminRoles, updateAdminRole, updateAdminUser } from '../db/admin.js'
import { listMvConfigs, upsertMvConfig } from '../db/mv.js'
import { getBiliCredentialStatus, resolveBiliVideoMeta, saveBiliCredential, verifyBiliCredential } from '../services/biliCredential.js'
import {
  clearAdminSessionCookie,
  ensureDefaultAdmin,
  hashPassword,
  loginAdmin,
  logoutAdmin,
  publicAdminUser,
  requireAdmin,
  setAdminSessionCookie,
} from '../services/adminAuth.js'

function bodyObject(value: unknown) {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export async function registerAdminRoutes(app: FastifyInstance) {
  await ensureDefaultAdmin()

  app.post('/auth/login', async (request, reply) => {
    const body = bodyObject(request.body)
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    const result = await loginAdmin(email, password)
    if (!result) return reply.code(401).send({ error: 'invalid_credentials' })
    setAdminSessionCookie(reply, result.session.id, result.session.expiresAt)
    return { user: publicAdminUser(result.user) }
  })

  app.post('/auth/logout', async (request, reply) => {
    logoutAdmin(request, reply)
    return { ok: true }
  })

  app.get('/me', async (request, reply) => {
    const user = requireAdmin(request, reply)
    if (!user) return reply
    return { user: publicAdminUser(user) }
  })

  app.get('/users', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    return { users: listAdminUsers().map(publicAdminUser) }
  })

  app.post('/users', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const body = bodyObject(request.body)
    const email = String(body.email ?? '').trim()
    const displayName = String(body.displayName ?? email).trim()
    const password = String(body.password ?? '')
    if (!email || password.length < 8) return reply.code(400).send({ error: 'invalid_user_input' })
    const user = createAdminUser({ email, displayName, passwordHash: await hashPassword(password), roles: normalizeAdminRoles(body.roles) })
    return reply.code(201).send({ user: user ? publicAdminUser(user) : null })
  })

  app.patch('/users/:id', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const params = request.params as { id: string }
    const body = bodyObject(request.body)
    const password = String(body.password ?? '')
    if (password && password.length < 8) return reply.code(400).send({ error: 'invalid_user_input' })
    const user = updateAdminUser(params.id, {
      displayName: typeof body.displayName === 'string' ? body.displayName : undefined,
      disabled: typeof body.disabled === 'boolean' ? body.disabled : undefined,
      roles: Array.isArray(body.roles) ? normalizeAdminRoles(body.roles) : undefined,
      passwordHash: password ? await hashPassword(password) : undefined,
    })
    if (!user) return reply.code(404).send({ error: 'user_not_found' })
    return { user: publicAdminUser(user) }
  })

  app.get('/roles', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    return { roles: listAdminRoles() }
  })

  app.post('/roles', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const body = bodyObject(request.body)
    const id = String(body.id ?? '').trim()
    const label = String(body.label ?? '').trim()
    if (!id || !label) return reply.code(400).send({ error: 'invalid_role_input' })
    try {
      const role = createAdminRole({ id, label })
      if (!role) return reply.code(400).send({ error: 'invalid_role_input' })
      return reply.code(201).send({ role })
    } catch (error) {
      return reply.code(400).send({ error: 'role_create_failed', message: error instanceof Error ? error.message : String(error) })
    }
  })

  app.patch('/roles/:id', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const params = request.params as { id: string }
    const body = bodyObject(request.body)
    const role = updateAdminRole(params.id, { label: String(body.label ?? '').trim() })
    if (!role) return reply.code(404).send({ error: 'role_not_found' })
    return { role }
  })

  app.delete('/roles/:id', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const params = request.params as { id: string }
    const result = deleteAdminRole(params.id)
    if (!result.ok) return reply.code(result.reason === 'system_role' ? 400 : 404).send({ error: result.reason || 'role_not_found' })
    return { ok: true }
  })

  app.get('/mvs', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const query = request.query as { q?: string; page?: string; pageSize?: string; onlyWithMv?: string; titleOnly?: string }
    return listMvConfigs({
      query: query.q ?? '',
      page: Number(query.page ?? 1),
      pageSize: Number(query.pageSize ?? 20),
      onlyWithMv: query.onlyWithMv === 'true' || query.onlyWithMv === '1',
      titleOnly: query.titleOnly === 'true' || query.titleOnly === '1',
    })
  })

  app.post('/mvs/parse-bili', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const body = bodyObject(request.body)
    const url = String(body.url ?? '').trim()
    if (!url) return reply.code(400).send({ error: 'missing_bili_url' })
    try {
      return { meta: await resolveBiliVideoMeta(url) }
    } catch (error) {
      return reply.code(400).send({ error: 'bili_parse_failed', message: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/mvs', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const body = bodyObject(request.body)
    const trackId = String(body.trackId ?? '').trim()
    if (!trackId) return reply.code(400).send({ error: 'missing_track_id' })
    const mv = upsertMvConfig({
      trackId,
      biliBvid: typeof body.biliBvid === 'string' ? body.biliBvid : null,
      biliPage: Number.isFinite(Number(body.biliPage)) ? Number(body.biliPage) : 1,
      coverUrl: typeof body.coverUrl === 'string' ? body.coverUrl : null,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : '16 / 9',
      isHomeFeatured: Boolean(body.isHomeFeatured),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    })
    return { mv }
  })

  app.patch('/mvs/:trackId', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const params = request.params as { trackId: string }
    const body = bodyObject(request.body)
    const mv = upsertMvConfig({
      trackId: params.trackId,
      biliBvid: typeof body.biliBvid === 'string' ? body.biliBvid : null,
      biliPage: Number.isFinite(Number(body.biliPage)) ? Number(body.biliPage) : 1,
      coverUrl: typeof body.coverUrl === 'string' ? body.coverUrl : null,
      aspectRatio: typeof body.aspectRatio === 'string' ? body.aspectRatio : '16 / 9',
      isHomeFeatured: Boolean(body.isHomeFeatured),
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0,
      enabled: body.enabled === undefined ? true : Boolean(body.enabled),
    })
    return { mv }
  })

  app.get('/bili-credential', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    return getBiliCredentialStatus()
  })

  app.put('/bili-credential', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const body = bodyObject(request.body)
    const cookie = String(body.cookie ?? '').trim()
    if (!cookie) return reply.code(400).send({ error: 'missing_cookie' })
    try {
      saveBiliCredential(cookie)
      return getBiliCredentialStatus()
    } catch (error) {
      return reply.code(400).send({ error: 'credential_save_failed', message: error instanceof Error ? error.message : String(error) })
    }
  })

  app.post('/bili-credential/verify', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    return await verifyBiliCredential()
  })

  app.post('/auth/clear-cookie', async (_request, reply) => {
    clearAdminSessionCookie(reply)
    return { ok: true }
  })
}
