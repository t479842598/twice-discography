import type { FastifyInstance } from 'fastify'
import { createAdminRole, createAdminUser, deleteAdminRole, listAdminRoles, listAdminUsers, normalizeAdminRoles, updateAdminRole, updateAdminUser } from '../db/admin.js'
import { getDatabase } from '../db/database.js'
import { listMvConfigs, upsertMvConfig } from '../db/mv.js'
import { getBiliCredentialStatus, getBiliProfile, resolveBiliVideoMeta, saveBiliCredential, verifyBiliCredential } from '../services/biliCredential.js'
import {
  clearAdminSessionCookie,
  ensureDefaultAdmin,
  getAdminFromRequest,
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

  app.get('/session', async (request) => {
    const user = getAdminFromRequest(request)
    return { user: user ? publicAdminUser(user) : null }
  })

  app.post('/auth/login', async (request, reply) => {
    const body = bodyObject(request.body)
    const email = String(body.email ?? '').trim()
    const password = String(body.password ?? '')
    const result = await loginAdmin(email, password)
    if (!result) return reply.code(401).send({ error: 'invalid_credentials', message: '账号或密码不正确' })
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

  app.get('/bili-profile', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    try {
      return await getBiliProfile()
    } catch (error) {
      return reply.code(502).send({ error: 'bili_profile_failed', message: error instanceof Error ? error.message : String(error) })
    }
  })

  app.get('/bili-credential', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    return getBiliCredentialStatus()
  })

  app.put('/bili-credential', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner'])) return reply
    const body = bodyObject(request.body)
    const cookie = String(body.cookie ?? '').trim()
    if (!cookie) return reply.code(400).send({ error: 'missing_cookie', message: '请先粘贴 B站 Cookie' })
    try {
      saveBiliCredential(cookie)
      return getBiliCredentialStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (message === 'missing_bili_credential_encryption_key') {
        return reply.code(500).send({ error: 'missing_bili_credential_encryption_key', message: '服务端缺少 BILI_CREDENTIAL_ENCRYPTION_KEY 配置' })
      }
      return reply.code(400).send({ error: 'credential_save_failed', message })
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

  // ---- Dashboard stats ----
  app.get('/stats', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const db = getDatabase()
    const catalog = {
      albums: (db.prepare('SELECT COUNT(*) as c FROM albums').get() as { c: number }).c,
      tracks: (db.prepare('SELECT COUNT(*) as c FROM tracks').get() as { c: number }).c,
      members: (db.prepare('SELECT COUNT(*) as c FROM members').get() as { c: number }).c,
      cfs: (db.prepare('SELECT COUNT(*) as c FROM cfs').get() as { c: number }).c,
      covers: (db.prepare('SELECT COUNT(*) as c FROM covers').get() as { c: number }).c,
    }
    const mvs = {
      pending: (db.prepare('SELECT COUNT(*) as c FROM mv_configs WHERE enabled = 1').get() as { c: number }).c,
      homeFeatured: (db.prepare('SELECT COUNT(*) as c FROM mv_configs WHERE enabled = 1 AND is_home_featured = 1').get() as { c: number }).c,
    }
    const admins = (db.prepare('SELECT COUNT(*) as c FROM admin_users WHERE disabled = 0').get() as { c: number }).c
    const r2Ready = db.prepare("SELECT COUNT(*) as c, COALESCE(SUM(size_bytes), 0) as totalBytes FROM music_assets WHERE status = 'ready'").get() as { c: number; totalBytes: number }
    const biliCredential = getBiliCredentialStatus()
    return {
      catalog,
      mvs,
      admins,
      r2Cache: { readyAssets: r2Ready.c, totalBytes: r2Ready.totalBytes },
      biliCredential,
    }
  })

  app.get('/recent-activity', async (request, reply) => {
    if (!requireAdmin(request, reply, ['owner', 'admin', 'editor'])) return reply
    const db = getDatabase()
    const mvUpdates = db.prepare("SELECT track_id, updated_at FROM mv_configs WHERE updated_at IS NOT NULL ORDER BY updated_at DESC LIMIT 5").all() as Array<{ track_id: string; updated_at: number }>
    const items = mvUpdates.map((row) => ({
      type: 'mv',
      title: row.track_id,
      description: 'MV 配置已更新',
      time: row.updated_at,
    }))
    return { items }
  })
}
