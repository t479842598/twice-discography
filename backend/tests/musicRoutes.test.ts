import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildServer } from '../src/server.js'
import { closeDatabase } from '../src/db/database.js'
import { clearMusicMemoryCache } from '../src/services/musicCache.js'

const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql')

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function textResponse(value = '') {
  return new Response(value, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  })
}

function seedDatabase(databasePath: string) {
  const db = new Database(databasePath)
  db.exec(fs.readFileSync(schemaPath, 'utf8'))
  db.prepare(`
    INSERT INTO tracks (
      id,
      title_zh,
      title_en,
      category,
      duration_sec,
      music_square_query,
      music_square_preferred,
      qq_song_mid,
      netease_song_id
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'fancy',
    'FANCY',
    'FANCY',
    'group',
    213,
    'TWICE FANCY',
    'qq',
    '003Gjd8u1wDES5',
    '1360662681',
  )
  db.close()
}

describe('music routes', () => {
  let databasePath: string

  beforeEach(() => {
    databasePath = path.join(os.tmpdir(), `twice-discography-${Date.now()}-${Math.random()}.db`)
    process.env.DATABASE_PATH = databasePath
    process.env.JOOX_TOKEN = ''
    seedDatabase(databasePath)
    clearMusicMemoryCache()
    closeDatabase()

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') {
        return textResponse('')
      }

      if (url.includes('tang.api.s01s.cn')) {
        return jsonResponse({
          song_name: 'FANCY',
          song_title: 'FANCY',
          album_name: 'FANCY YOU',
          song_mid: '003Gjd8u1wDES5',
          singer_name: 'TWICE',
          song_play_time: 213,
          song_play_url_sq: 'http://isure6.stream.qqmusic.qq.com/F000001iDrM93nhMYs.flac',
          kbps_sq: 1899,
          song_lyric: '[00:00.000]FANCY',
        })
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=lrc')) {
        return textResponse('[00:00.000]FANCY')
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=url')) {
        return textResponse('')
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    closeDatabase()
    clearMusicMemoryCache()
    if (fs.existsSync(databasePath)) fs.unlinkSync(databasePath)
  })

  it('returns multi-source candidates and selects QQ by default', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/music-candidates',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.selectedSource).toBe('qq')
    expect(body.candidates.map((item: { source: string }) => item.source)).toContain('qq')
    expect(body.candidates.map((item: { source: string }) => item.source)).toContain('netease')
    expect(body.candidates.find((item: { source: string }) => item.source === 'qq').recommended).toBe(true)
  })

  it('returns HTTPS QQ playback when no source is specified', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.selectedSource).toBe('qq')
    expect(body.audioUrl).toMatch(/^https:\/\/isure6\.stream\.qqmusic\.qq\.com/)
    expect(body.selected.quality.tag).toBe('lossless')
    expect(body.lrcAvailable).toBe(true)
  })

  it('supports manually selecting Netease playback', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback?source=netease',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.selectedSource).toBe('netease')
    expect(body.audioUrl).toContain('server=netease')
  })

  it('does not use QQ accompaniment URLs for playback', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') {
        return textResponse('')
      }

      if (url.includes('tang.api.s01s.cn')) {
        return jsonResponse({
          song_name: 'FANCY',
          song_title: 'FANCY',
          album_name: 'FANCY YOU',
          song_mid: '003Gjd8u1wDES5',
          singer_name: 'TWICE',
          song_play_time: 213,
          song_play_url_accom: 'http://example.com/fancy-accompaniment.m4a',
          kbps_accom: 999,
          song_play_url_standard: 'http://example.com/fancy-vocal.mp3',
          kbps_standard: 128,
        })
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=lrc')) {
        return textResponse('[00:00.000]FANCY')
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=url')) {
        return textResponse('')
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback?source=qq',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.audioUrl).toBe('https://example.com/fancy-vocal.mp3')
    expect(body.audioUrl).not.toContain('accompaniment')
    expect(body.selected.quality.tag).toBe('standard')
  })
})
