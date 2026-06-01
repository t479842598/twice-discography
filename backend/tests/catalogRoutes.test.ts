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

  it('infers member credits for solo and unit album tracks', async () => {
    const app = buildServer()
    const [nayeonResponse, tenTrackResponse, unitTrackResponse, misamoSoloResponse] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/members/nayeon' }),
      app.inject({ method: 'GET', url: '/api/tracks/apple-twice-1840284144' }),
      app.inject({ method: 'GET', url: '/api/tracks/apple-twice-1813491330' }),
      app.inject({ method: 'GET', url: '/api/tracks/apple-misamo-1772137192' }),
    ])
    await app.close()

    expect(nayeonResponse.statusCode).toBe(200)
    expect(tenTrackResponse.statusCode).toBe(200)
    expect(unitTrackResponse.statusCode).toBe(200)
    expect(misamoSoloResponse.statusCode).toBe(200)

    const nayeonBody = nayeonResponse.json()
    expect(nayeonBody.member.tracks.some((track: { id: string }) => track.id === 'apple-twice-1840284144')).toBe(true)
    expect(nayeonBody.member.tracks.some((track: { id: string }) => track.id === 'apple-twice-1813491330')).toBe(true)

    const tenTrack = tenTrackResponse.json().track
    expect(tenTrack.category).toBe('solo')
    expect(tenTrack.memberIds).toEqual(['nayeon'])

    const unitTrack = unitTrackResponse.json().track
    expect(unitTrack.category).toBe('unit')
    expect(unitTrack.memberIds).toEqual(['nayeon', 'jeongyeon', 'momo', 'mina'])

    const misamoSoloTrack = misamoSoloResponse.json().track
    expect(misamoSoloTrack.category).toBe('solo')
    expect(misamoSoloTrack.memberIds).toEqual(['mina'])
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
