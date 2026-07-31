import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

let connection: Database.Database | null = null
let connectionPath: string | null = null

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(moduleDirectory, '../../..')
const backendRoot = path.resolve(projectRoot, 'backend')

function hasInitializedSchema(candidate: string) {
  if (!fs.existsSync(candidate)) return false
  try {
    const db = new Database(candidate, { readonly: true, fileMustExist: true })
    const row = db.prepare(`
      SELECT 1 AS present
      FROM sqlite_master
      WHERE type = 'table' AND name IN ('albums', 'admin_users', 'bili_credentials')
      LIMIT 1
    `).get() as { present?: number } | undefined
    db.close()
    return Boolean(row?.present)
  } catch {
    return false
  }
}

export function resolveDatabasePath() {
  const configured = process.env.DATABASE_PATH ?? './data/twice.db'
  if (configured === ':memory:' || path.isAbsolute(configured)) return configured

  const canonicalPath = path.resolve(projectRoot, configured)
  if (hasInitializedSchema(canonicalPath)) return canonicalPath

  // Older package scripts resolved relative paths from backend/. Keep an
  // initialized legacy database selected so existing accounts never vanish
  // merely because the process was launched from a different directory.
  const legacyCandidates = [
    path.resolve(process.cwd(), configured),
    path.resolve(backendRoot, configured),
  ]
  for (const candidate of legacyCandidates) {
    if (candidate !== canonicalPath && hasInitializedSchema(candidate)) return candidate
  }

  return canonicalPath
}

export function getDatabase() {
  const databasePath = resolveDatabasePath()
  if (connection && connectionPath === databasePath) return connection

  closeDatabase()

  const directory = path.dirname(databasePath)
  if (databasePath !== ':memory:' && !fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true })
  }

  connection = new Database(databasePath)
  connectionPath = databasePath
  connection.pragma('foreign_keys = ON')

  return connection
}

export function closeDatabase() {
  if (connection) {
    connection.close()
  }

  connection = null
  connectionPath = null
}

export function ensureRuntimeMigrations() {
  const db = getDatabase()
  const albumColumns = db.prepare('PRAGMA table_info(albums)').all() as Array<{ name: string }>
  if (albumColumns.length > 0 && !albumColumns.some((column) => column.name === 'cover_remote')) {
    db.prepare('ALTER TABLE albums ADD COLUMN cover_remote TEXT').run()
  }

  const sessionColumns = db.prepare('PRAGMA table_info(admin_sessions)').all() as Array<{ name: string }>
  if (sessionColumns.length > 0 && !sessionColumns.some((column) => column.name === 'csrf_token')) {
    db.prepare('ALTER TABLE admin_sessions ADD COLUMN csrf_token TEXT').run()
    // Existing sessions predate CSRF protection and cannot be upgraded safely.
    db.prepare('DELETE FROM admin_sessions').run()
  }

  const credentialColumns = db.prepare('PRAGMA table_info(bili_credentials)').all() as Array<{ name: string }>
  if (credentialColumns.length > 0 && !credentialColumns.some((column) => column.name === 'encryption_version')) {
    db.prepare('ALTER TABLE bili_credentials ADD COLUMN encryption_version TEXT').run()
  }
  if (credentialColumns.length > 0 && !credentialColumns.some((column) => column.name === 'key_id')) {
    db.prepare('ALTER TABLE bili_credentials ADD COLUMN key_id TEXT').run()
  }
}
