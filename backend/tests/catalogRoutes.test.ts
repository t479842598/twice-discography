import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../src/server.js'
import { closeDatabase } from '../src/db/database.js'
import { initializeDatabase } from '../src/db/init.js'

describe('catalog routes', () => {
  let databasePath: string

  beforeEach(() => {
    databasePath = path.join(os.tmpdir(), `twice-catalog-${Date.now()}-${Math.random()}.db`)
    process.env.DATABASE_PATH = databasePath
    initializeDatabase()
  })

  afterEach(() => {
    closeDatabase()
    if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath)
  })

  it('returns overview with years and category stats', async () => {
    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/catalog/overview' })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.stats.tracks).toBeGreaterThan(10)
    expect(body.years.some((item: { year: number }) => item.year === 2019)).toBe(true)
    expect(body.categories.some((item: { key: string }) => item.key === 'solo')).toBe(true)
  })

  it('returns album detail with tracks', async () => {
    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/albums/fancy-you' })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.album.title.en).toBe('FANCY YOU')
    expect(body.album.tracks.some((track: { id: string }) => track.id === 'fancy')).toBe(true)
  })

  it('searches tracks and members', async () => {
    const app = buildServer()
    const response = await app.inject({ method: 'GET', url: '/api/search?q=FANCY' })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.results.tracks.some((track: { id: string }) => track.id === 'fancy')).toBe(true)
  })
})
