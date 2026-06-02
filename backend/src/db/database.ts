import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

let connection: Database.Database | null = null
let connectionPath: string | null = null

export function resolveDatabasePath() {
  const configured = process.env.DATABASE_PATH ?? './data/twice.db'
  return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
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
}
