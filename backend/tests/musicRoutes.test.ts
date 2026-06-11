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
    process.env.MUSIC_R2_CACHE_ENABLED = 'false'
    process.env.MUSIC_R2_CACHE_MISS_MODE = 'background'
    process.env.MUSIC_R2_MIN_AUDIO_BYTES = '16384'
    process.env.R2_ACCOUNT_ID = ''
    process.env.R2_ACCESS_KEY_ID = ''
    process.env.R2_SECRET_ACCESS_KEY = ''
    process.env.R2_BUCKET = ''
    process.env.R2_PUBLIC_BASE_URL = ''
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

  it('returns cached R2 playback without resolving upstream again', async () => {
    const db = new Database(databasePath)
    db.prepare(`
      INSERT INTO music_assets (
        id, track_id, source, provider_id, quality_tag, r2_key, public_url,
        status, content_type, size_bytes, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?)
    `).run(
      'qq:003Gjd8u1wDES5:lossless',
      'fancy',
      'qq',
      '003Gjd8u1wDES5',
      'lossless',
      'music/qq/003Gjd8u1wDES5/lossless.flac',
      'https://media.example.com/music/qq/003Gjd8u1wDES5/lossless.flac',
      'audio/flac',
      123456,
      Date.now(),
      Date.now(),
    )
    db.close()
    const fetchMock = vi.fn(async () => {
      throw new Error('upstream should not be called')
    })
    vi.stubGlobal('fetch', fetchMock)

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().audioUrl).toBe('https://media.example.com/music/qq/003Gjd8u1wDES5/lossless.flac')
  })

  it('uploads playback to R2 in blocking cache mode', async () => {
    process.env.MUSIC_R2_CACHE_ENABLED = 'true'
    process.env.MUSIC_R2_CACHE_MISS_MODE = 'blocking'
    process.env.MUSIC_R2_MIN_AUDIO_BYTES = '1'
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'twice-music-assets'
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com'
    const audioBytes = new Uint8Array([1, 2, 3, 4])

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') return textResponse('')
      if (init?.method === 'GET' && url.includes('r2.cloudflarestorage.com')) {
        return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>', { status: 200, headers: { 'content-type': 'application/xml' } })
      }
      if (init?.method === 'PUT' && url.includes('r2.cloudflarestorage.com')) {
        return new Response('', { status: 200, headers: { etag: '"r2-etag"' } })
      }
      if (url.includes('isure6.stream.qqmusic.qq.com')) {
        return new Response(audioBytes, { status: 200, headers: { 'content-type': 'audio/flac' } })
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
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().audioUrl).toBe('https://media.example.com/music/qq/003Gjd8u1wDES5/lossless.flac')

    const db = new Database(databasePath)
    const asset = db.prepare('SELECT status, public_url, etag FROM music_assets WHERE source = ? AND provider_id = ?').get('qq', '003Gjd8u1wDES5') as { status: string; public_url: string; etag: string }
    db.close()
    expect(asset.status).toBe('ready')
    expect(asset.public_url).toBe('https://media.example.com/music/qq/003Gjd8u1wDES5/lossless.flac')
    expect(asset.etag).toBe('"r2-etag"')
  })

  it('keeps upstream playback available when R2 upload fails', async () => {
    process.env.MUSIC_R2_CACHE_ENABLED = 'true'
    process.env.MUSIC_R2_CACHE_MISS_MODE = 'blocking'
    process.env.MUSIC_R2_MIN_AUDIO_BYTES = '1'
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'twice-music-assets'
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com'

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') return textResponse('')
      if (init?.method === 'GET' && url.includes('r2.cloudflarestorage.com')) {
        return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>', { status: 200, headers: { 'content-type': 'application/xml' } })
      }
      if (init?.method === 'PUT' && url.includes('r2.cloudflarestorage.com')) return new Response('nope', { status: 500 })
      if (url.includes('isure6.stream.qqmusic.qq.com')) return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/flac' } })
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
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().audioUrl).toMatch(/^https:\/\/isure6\.stream\.qqmusic\.qq\.com/)

    const db = new Database(databasePath)
    const asset = db.prepare('SELECT status, error FROM music_assets WHERE source = ? AND provider_id = ?').get('qq', '003Gjd8u1wDES5') as { status: string; error: string }
    db.close()
    expect(asset.status).toBe('failed')
    expect(asset.error).toContain('r2_upload_http_500')
  })

  it('does not upload when R2 cache size limit would be exceeded', async () => {
    process.env.MUSIC_R2_CACHE_ENABLED = 'true'
    process.env.MUSIC_R2_CACHE_MISS_MODE = 'blocking'
    process.env.MUSIC_R2_MIN_AUDIO_BYTES = '1'
    process.env.MUSIC_R2_MAX_BYTES = '3'
    process.env.R2_ACCOUNT_ID = 'test-account'
    process.env.R2_ACCESS_KEY_ID = 'test-key'
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret'
    process.env.R2_BUCKET = 'twice-music-assets'
    process.env.R2_PUBLIC_BASE_URL = 'https://media.example.com'

    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') return textResponse('')
      if (init?.method === 'GET' && url.includes('r2.cloudflarestorage.com')) {
        return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>', { status: 200, headers: { 'content-type': 'application/xml' } })
      }
      if (init?.method === 'PUT') throw new Error('R2 upload should not be attempted')
      if (url.includes('isure6.stream.qqmusic.qq.com')) return new Response(new Uint8Array([1, 2, 3, 4]), { status: 200, headers: { 'content-type': 'audio/flac' } })
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
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/tracks/fancy/playback',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().audioUrl).toMatch(/^https:\/\/isure6\.stream\.qqmusic\.qq\.com/)

    const db = new Database(databasePath)
    const asset = db.prepare('SELECT status, error FROM music_assets WHERE source = ? AND provider_id = ?').get('qq', '003Gjd8u1wDES5') as { status: string; error: string }
    db.close()
    expect(asset.status).toBe('failed')
    expect(asset.error).toContain('r2_cache_limit_exceeded')
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

  it('searches public music candidates', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = String(input)

      if (url.includes('tang.api.s01s.cn')) {
        return jsonResponse([{ song_mid: '003Gjd8u1wDES5', song_title: 'FANCY', singer_name: 'TWICE', pay: 0 }])
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=search')) {
        return jsonResponse([])
      }

      if (url.includes('kw-api.cenguigui.cn')) {
        return jsonResponse({ data: [] })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/search?q=FANCY&sources=qq,netease,kuwo&limit=5',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.query).toBe('FANCY')
    expect(body.results).toHaveLength(1)
    expect(body.results[0].source).toBe('qq')
    expect(body.results[0].providerId).toBe('003Gjd8u1wDES5')
  })

  it('resolves a public QQ search result for playback and download', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/resolve?q=TWICE%20FANCY&source=qq&providerId=003Gjd8u1wDES5&quality=lossless',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.source).toBe('qq')
    expect(body.audioUrl).toMatch(/^https:\/\/isure6\.stream\.qqmusic\.qq\.com/)
    expect(body.selected.playable).toBe(true)
    expect(body.lrcAvailable).toBe(true)
  })

  it('does not use R2 cache for public music station resolves', async () => {
    const db = new Database(databasePath)
    db.prepare(`
      INSERT INTO music_assets (
        id, track_id, source, provider_id, quality_tag, r2_key, public_url,
        status, content_type, size_bytes, created_at, updated_at
      )
      VALUES (?, NULL, ?, ?, ?, ?, ?, 'ready', ?, ?, ?, ?)
    `).run(
      'qq:003Gjd8u1wDES5:lossless',
      'qq',
      '003Gjd8u1wDES5',
      'lossless',
      'music/qq/003Gjd8u1wDES5/lossless.flac',
      'https://media.example.com/music/qq/003Gjd8u1wDES5/lossless.flac',
      'audio/flac',
      123456,
      Date.now(),
      Date.now(),
    )
    db.close()

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/resolve?q=TWICE%20FANCY&source=qq&providerId=003Gjd8u1wDES5&quality=lossless',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    expect(response.json().audioUrl).toMatch(/^https:\/\/isure6\.stream\.qqmusic\.qq\.com/)
  })

  it('falls back to another source when QQ has no audio URL', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') {
        return textResponse('')
      }

      if (url.includes('tang.api.s01s.cn') && url.includes('mid=000EmptyAudio')) {
        return jsonResponse({
          song_name: 'LEMONADE',
          song_title: 'LEMONADE',
          album_name: 'LEMONADE',
          song_mid: '000EmptyAudio',
          singer_name: 'aespa',
          song_play_time: 187,
          song_play_url_sq: '',
          song_play_url_standard: '',
        })
      }

      if (url.includes('tang.api.s01s.cn')) {
        return jsonResponse([{ song_mid: '000EmptyAudio', song_title: 'LEMONADE', singer_name: 'aespa' }])
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=search')) {
        return jsonResponse([{
          name: 'LEMONADE',
          artist: 'aespa',
          url: 'https://api.qijieya.cn/meting/?server=netease&type=url&id=3387484666',
          pic: 'https://example.com/lemonade.jpg',
          lrc: 'https://api.qijieya.cn/meting/?server=netease&type=lrc&id=3387484666',
        }])
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=lrc')) {
        return textResponse('[00:00.000]LEMONADE')
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=url')) {
        return textResponse('')
      }

      if (url.includes('kw-api.cenguigui.cn')) {
        return jsonResponse({ data: [] })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/resolve?q=lemonade&source=qq&providerId=000EmptyAudio&quality=best',
    })
    await app.close()

    expect(response.statusCode).toBe(200)
    const body = response.json()
    expect(body.source).toBe('netease')
    expect(body.selected.title).toBe('LEMONADE')
    expect(body.selected.artist).toBe('aespa')
    expect(body.audioUrl).toContain('server=netease')
  })

  it('does not fall back to a playable different version', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)

      if (init?.method === 'HEAD') {
        return textResponse('')
      }

      if (url.includes('tang.api.s01s.cn') && url.includes('mid=000EmptyAudio')) {
        return jsonResponse({
          song_name: 'LEMONADE',
          song_title: 'LEMONADE',
          album_name: 'LEMONADE',
          song_mid: '000EmptyAudio',
          singer_name: 'aespa',
          song_play_time: 187,
          song_play_url_sq: '',
          song_play_url_standard: '',
        })
      }

      if (url.includes('tang.api.s01s.cn')) {
        return jsonResponse([{ song_mid: '000EmptyAudio', song_title: 'LEMONADE', singer_name: 'aespa' }])
      }

      if (url.includes('api.qijieya.cn') && url.includes('type=search')) {
        return jsonResponse([])
      }

      if (url.includes('kw-api.cenguigui.cn') && url.includes('name=')) {
        return jsonResponse({
          data: [{
            rid: '580967179',
            name: 'LEMONADE (Zedd Remix)',
            artist: 'aespa&Zedd',
            album: 'LEMONADE (Zedd Remix)',
            pic: 'https://example.com/remix.jpg',
          }],
        })
      }

      if (url.includes('kw-api.cenguigui.cn') && url.includes('id=580967179')) {
        return jsonResponse({
          data: {
            rid: '580967179',
            name: 'LEMONADE (Zedd Remix)',
            artist: 'aespa&Zedd',
            album: 'LEMONADE (Zedd Remix)',
            url: 'https://music.example.com/remix.flac',
            bitrate: 2000,
            quality: 'flac',
          },
        })
      }

      throw new Error(`Unexpected fetch: ${url}`)
    }))

    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/resolve?q=lemonade&source=qq&providerId=000EmptyAudio&quality=best',
    })
    await app.close()

    expect(response.statusCode).toBe(404)
    expect(response.json().error).toBe('music_not_available')
  })

  it('rejects invalid public resolve requests', async () => {
    const app = buildServer()
    const response = await app.inject({
      method: 'GET',
      url: '/api/music/resolve?q=FANCY&source=bad&providerId=123',
    })
    await app.close()

    expect(response.statusCode).toBe(400)
    expect(response.json().error).toBe('invalid_source')
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
