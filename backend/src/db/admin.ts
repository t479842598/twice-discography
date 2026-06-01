import { randomUUID } from 'node:crypto'
import { getDatabase } from './database.js'

export type AdminRole = string

export interface AdminUserRecord {
  id: string
  email: string
  displayName: string
  disabled: boolean
  roles: AdminRole[]
  createdAt: number
  updatedAt: number
}

export interface AdminRoleRecord {
  id: string
  label: string
  system: boolean
  createdAt: number
}

interface AdminUserRow {
  id: string
  email: string
  display_name: string
  disabled: number
  created_at: number
  updated_at: number
  roles?: string | null
}

interface AdminRoleRow {
  id: string
  label: string
  created_at: number
}

const defaultRoles: Array<{ id: AdminRole; label: string }> = [
  { id: 'owner', label: '所有者' },
  { id: 'admin', label: '管理员' },
  { id: 'editor', label: '内容编辑' },
]
const systemRoleIds = new Set(defaultRoles.map((role) => role.id))

function mapUser(row: AdminUserRow): AdminUserRecord {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    disabled: Boolean(row.disabled),
    roles: (row.roles ? row.roles.split(',') : []).filter(Boolean),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

export function ensureAdminDefaults(hashDefaultPassword: () => Promise<string> | string) {
  const db = getDatabase()
  const now = Date.now()
  const insertRole = db.prepare('INSERT OR IGNORE INTO admin_roles (id, label, created_at) VALUES (?, ?, ?)')
  const updateRole = db.prepare('UPDATE admin_roles SET label = ? WHERE id = ?')
  for (const role of defaultRoles) {
    insertRole.run(role.id, role.label, now)
    updateRole.run(role.label, role.id)
  }

  const count = db.prepare('SELECT COUNT(*) AS count FROM admin_users').get() as { count: number }
  if (count.count > 0) return Promise.resolve(null)

  return Promise.resolve(hashDefaultPassword()).then((passwordHash) => {
    const id = randomUUID()
    db.prepare(`
      INSERT INTO admin_users (id, email, display_name, password_hash, disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, 'admin', '默认管理员', passwordHash, now, now)
    db.prepare('INSERT INTO admin_user_roles (user_id, role_id) VALUES (?, ?)').run(id, 'owner')
    return findAdminUserById(id)
  })
}

export function adminUserCount() {
  const row = getDatabase().prepare('SELECT COUNT(*) AS count FROM admin_users').get() as { count: number }
  return row.count
}

export function listAdminUsers() {
  const rows = getDatabase().prepare(`
    SELECT admin_users.*, GROUP_CONCAT(admin_user_roles.role_id) AS roles
    FROM admin_users
    LEFT JOIN admin_user_roles ON admin_user_roles.user_id = admin_users.id
    GROUP BY admin_users.id
    ORDER BY admin_users.created_at DESC
  `).all() as AdminUserRow[]
  return rows.map(mapUser)
}

export function findAdminUserById(id: string) {
  const row = getDatabase().prepare(`
    SELECT admin_users.*, GROUP_CONCAT(admin_user_roles.role_id) AS roles
    FROM admin_users
    LEFT JOIN admin_user_roles ON admin_user_roles.user_id = admin_users.id
    WHERE admin_users.id = ?
    GROUP BY admin_users.id
  `).get(id) as AdminUserRow | undefined
  return row ? mapUser(row) : null
}

export function findAdminUserByEmail(email: string) {
  const row = getDatabase().prepare(`
    SELECT admin_users.*, GROUP_CONCAT(admin_user_roles.role_id) AS roles
    FROM admin_users
    LEFT JOIN admin_user_roles ON admin_user_roles.user_id = admin_users.id
    WHERE lower(admin_users.email) = lower(?)
    GROUP BY admin_users.id
  `).get(email) as AdminUserRow | undefined
  return row ? mapUser(row) : null
}

export function getAdminPasswordHash(email: string) {
  const row = getDatabase().prepare('SELECT password_hash FROM admin_users WHERE lower(email) = lower(?) AND disabled = 0').get(email) as { password_hash: string } | undefined
  return row?.password_hash ?? null
}

export function listAdminRoles() {
  const rows = getDatabase().prepare(`SELECT id, label, created_at FROM admin_roles ORDER BY CASE id WHEN 'owner' THEN 1 WHEN 'admin' THEN 2 WHEN 'editor' THEN 3 ELSE 10 END, created_at ASC`).all() as AdminRoleRow[]
  return rows.map((row): AdminRoleRecord => ({
    id: row.id,
    label: row.label,
    system: systemRoleIds.has(row.id),
    createdAt: Number(row.created_at),
  }))
}

export function roleIds() {
  return new Set(listAdminRoles().map((role) => role.id))
}

export function normalizeAdminRoles(value: unknown) {
  const available = roleIds()
  const roles = Array.isArray(value)
    ? value.map((role) => String(role).trim()).filter((role) => available.has(role))
    : []
  return roles.length ? Array.from(new Set(roles)) : ['editor']
}

export function createAdminRole(input: { id: string; label: string }) {
  const id = input.id.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-')
  const label = input.label.trim()
  if (!id || !label) return null
  const now = Date.now()
  getDatabase().prepare('INSERT INTO admin_roles (id, label, created_at) VALUES (?, ?, ?)').run(id, label, now)
  return listAdminRoles().find((role) => role.id === id) ?? null
}

export function updateAdminRole(id: string, input: { label: string }) {
  const label = input.label.trim()
  if (!label) return null
  const result = getDatabase().prepare('UPDATE admin_roles SET label = ? WHERE id = ?').run(label, id)
  if (result.changes === 0) return null
  return listAdminRoles().find((role) => role.id === id) ?? null
}

export function deleteAdminRole(id: string) {
  if (systemRoleIds.has(id)) return { ok: false, reason: 'system_role' }
  const db = getDatabase()
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM admin_user_roles WHERE role_id = ?').run(id)
    return db.prepare('DELETE FROM admin_roles WHERE id = ?').run(id).changes > 0
  })
  return { ok: transaction(), reason: null }
}


export function createAdminUser(input: { email: string; displayName: string; passwordHash: string; roles: AdminRole[] }) {
  const db = getDatabase()
  const now = Date.now()
  const id = randomUUID()
  const roles = input.roles.length ? input.roles : ['editor']
  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO admin_users (id, email, display_name, password_hash, disabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `).run(id, input.email.trim(), input.displayName.trim() || input.email.trim(), input.passwordHash, now, now)
    const insertRole = db.prepare('INSERT INTO admin_user_roles (user_id, role_id) VALUES (?, ?)')
    for (const role of roles) insertRole.run(id, role)
  })
  transaction()
  return findAdminUserById(id)
}

export function updateAdminUser(id: string, input: { displayName?: string; disabled?: boolean; roles?: AdminRole[]; passwordHash?: string }) {
  const db = getDatabase()
  const existing = findAdminUserById(id)
  if (!existing) return null

  const now = Date.now()
  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE admin_users
      SET display_name = ?, disabled = ?, password_hash = COALESCE(?, password_hash), updated_at = ?
      WHERE id = ?
    `).run(input.displayName?.trim() || existing.displayName, input.disabled === undefined ? Number(existing.disabled) : Number(input.disabled), input.passwordHash ?? null, now, id)

    if (input.roles) {
      db.prepare('DELETE FROM admin_user_roles WHERE user_id = ?').run(id)
      const insertRole = db.prepare('INSERT INTO admin_user_roles (user_id, role_id) VALUES (?, ?)')
      for (const role of input.roles.length ? input.roles : ['editor']) insertRole.run(id, role)
    }
  })
  transaction()
  return findAdminUserById(id)
}

export function createAdminSession(userId: string, ttlMs: number) {
  const id = randomUUID()
  const now = Date.now()
  const expiresAt = now + ttlMs
  getDatabase().prepare('INSERT INTO admin_sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run(id, userId, expiresAt, now)
  return { id, expiresAt }
}

export function findAdminSession(sessionId: string) {
  const row = getDatabase().prepare('SELECT user_id, expires_at FROM admin_sessions WHERE id = ?').get(sessionId) as { user_id: string; expires_at: number } | undefined
  if (!row) return null
  if (row.expires_at <= Date.now()) {
    deleteAdminSession(sessionId)
    return null
  }
  return findAdminUserById(row.user_id)
}

export function deleteAdminSession(sessionId: string) {
  getDatabase().prepare('DELETE FROM admin_sessions WHERE id = ?').run(sessionId)
}

export function pruneExpiredAdminSessions() {
  getDatabase().prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(Date.now())
}
