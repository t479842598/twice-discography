import { getDatabase } from '../db/database.js'

interface MemoryCacheEntry {
  expiresAt: number
  value: unknown
}

const memoryCache = new Map<string, MemoryCacheEntry>()

function readDatabaseCache<T>(cacheKey: string) {
  try {
    const row = getDatabase().prepare(`
      SELECT value_json, expires_at
      FROM music_cache
      WHERE cache_key = ?
    `).get(cacheKey) as { value_json: string; expires_at: number } | undefined

    if (!row || row.expires_at <= Date.now()) return null
    return JSON.parse(row.value_json) as T
  } catch {
    return null
  }
}

function writeDatabaseCache(cacheKey: string, value: unknown, expiresAt: number) {
  try {
    getDatabase().prepare(`
      INSERT INTO music_cache (cache_key, value_json, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(cache_key) DO UPDATE SET
        value_json = excluded.value_json,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at
    `).run(cacheKey, JSON.stringify(value), expiresAt, Date.now(), Date.now())
  } catch {
    // Cache writes should never make music playback fail.
  }
}

export async function withMusicCache<T>(cacheKey: string, ttlMs: number, loader: () => Promise<T>) {
  const now = Date.now()
  const memory = memoryCache.get(cacheKey)
  if (memory && memory.expiresAt > now) return memory.value as T

  const database = readDatabaseCache<T>(cacheKey)
  if (database) {
    memoryCache.set(cacheKey, { value: database, expiresAt: now + ttlMs })
    return database
  }

  const value = await loader()
  const expiresAt = now + ttlMs
  memoryCache.set(cacheKey, { value, expiresAt })
  writeDatabaseCache(cacheKey, value, expiresAt)

  return value
}

export function clearMusicMemoryCache() {
  memoryCache.clear()
}
