import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildServer } from '../src/server.js'
import { closeDatabase } from '../src/db/database.js'
import { initializeDatabase } from '../src/db/init.js'

const TEST_ADMIN_PASSWORD = 'test-bootstrap-password-123'

describe('catalog routes', () => {
  let databasePath: string

  beforeEach(() => {
    databasePath = path.join(os.tmpdir(), `twice-catalog-${Date.now()}-${Math.random()}.db`)
    process.env.DATABASE_PATH = databasePath
    process.env.ADMIN_DEFAULT_PASSWORD = TEST_ADMIN_PASSWORD
    process.env.NODE_ENV = 'test'
    process.env.FRONTEND_ORIGIN = 'http://localhost:5173'
    process.env.CORS_ORIGIN = ''
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

  it('returns original cover URLs as a fallback for localized cover caches', async () => {
    const app = buildServer()
    const [albumsResponse, trackResponse] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/albums' }),
      app.inject({ method: 'GET', url: '/api/tracks/apple-twice-1555389973' }),
    ])
    await app.close()

    expect(albumsResponse.statusCode).toBe(200)
    expect(trackResponse.statusCode).toBe(200)

    const album = albumsResponse.json().albums.find((item: { id: string }) => item.id === 'apple-twice-1555389971')
    expect(album.coverLocal).toMatch(/apple-twice-1555389971\.jpg$/)
    expect(album.coverRemote).toMatch(/^https:\/\/is1-ssl\.mzstatic\.com\//)
    expect(trackResponse.json().track.coverRemote).toBe(album.coverRemote)
  })

  it('serves static covers with cross-origin resource policy', async () => {
    const app = buildServer()
    const response = await app.inject({ method: 'HEAD', url: '/static/albums/apple-twice-1555389971.jpg' })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin')
  })

  it('checks admin sessions without logging passive 401 errors', async () => {
    const app = buildServer()
    await app.ready()
    const anonymousSession = await app.inject({ method: 'GET', url: '/api/admin/session' })
    const failedLogin = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: 'admin', password: 'wrong-password' },
    })
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: 'admin', password: TEST_ADMIN_PASSWORD },
    })
    const session = await app.inject({
      method: 'GET',
      url: '/api/admin/session',
      headers: { cookie: login.headers['set-cookie'] },
    })
    await app.close()

    expect(anonymousSession.statusCode).toBe(200)
    expect(anonymousSession.json().user).toBeNull()
    expect(failedLogin.statusCode).toBe(401)
    expect(failedLogin.json().message).toBe('账号或密码不正确')
    expect(login.statusCode).toBe(200)
    expect(session.statusCode).toBe(200)
    expect(session.json().user.email).toBe('admin')
  })

  it('rejects cross-site and CSRF-less admin mutations', async () => {
    const app = buildServer()
    await app.ready()
    const login = await app.inject({
      method: 'POST',
      url: '/api/admin/auth/login',
      payload: { email: 'admin', password: TEST_ADMIN_PASSWORD },
    })
    const { csrfToken } = login.json() as { csrfToken: string }
    const cookie = login.headers['set-cookie']

    const missingToken = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie },
      payload: { id: 'reviewer', label: 'Reviewer' },
    })
    const invalidOrigin = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie, origin: 'https://attacker.example', 'x-csrf-token': csrfToken },
      payload: { id: 'reviewer', label: 'Reviewer' },
    })
    const accepted = await app.inject({
      method: 'POST',
      url: '/api/admin/roles',
      headers: { cookie, origin: 'http://localhost:5173', 'x-csrf-token': csrfToken },
      payload: { id: 'reviewer', label: 'Reviewer' },
    })
    await app.close()

    expect(missingToken.statusCode).toBe(403)
    expect(missingToken.json().error).toBe('invalid_csrf_token')
    expect(invalidOrigin.statusCode).toBe(403)
    expect(invalidOrigin.json().error).toBe('invalid_origin')
    expect(accepted.statusCode).toBe(201)
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
