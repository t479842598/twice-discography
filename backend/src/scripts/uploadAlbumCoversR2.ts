import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash, createHmac } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { closeDatabase, getDatabase } from '../db/database.js'
import { appleAlbums } from '../db/seed/appleCatalog.js'
import { albums as seedAlbums } from '../db/seed/catalog.js'

interface AlbumCoverRow {
  id: string
  cover_local: string | null
}

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
}

interface CoverAsset {
  album: AlbumCoverRow
  key: string
  publicUrl: string
  bytes: Uint8Array
  contentType: string
}

function toBody(bytes: Uint8Array): Buffer {
  return Buffer.from(bytes)
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')
const repoRoot = path.resolve(backendRoot, '..')
const albumCoverDir = path.join(backendRoot, 'public', 'albums')
const REGION = 'auto'
const SERVICE = 's3'
const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const concurrency = Number(process.env.COVER_R2_CONCURRENCY || process.env.COVER_DOWNLOAD_CONCURRENCY || 6)

const originalCoverByAlbumId = new Map(
  [...seedAlbums, ...appleAlbums]
    .filter((album) => typeof album.cover_local === 'string' && /^https?:\/\//i.test(album.cover_local))
    .map((album) => [album.id, album.cover_local as string]),
)

dotenv.config({ path: path.join(repoRoot, '.env') })
dotenv.config()

function env(name: string) {
  return process.env[name]?.trim() ?? ''
}

function getR2Config(): R2Config {
  const config = {
    accountId: env('R2_ACCOUNT_ID'),
    accessKeyId: env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('R2_SECRET_ACCESS_KEY'),
    bucket: env('R2_BUCKET'),
    publicBaseUrl: env('R2_PUBLIC_BASE_URL').replace(/\/+$/, ''),
  }
  if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket || !config.publicBaseUrl) {
    throw new Error('Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET / R2_PUBLIC_BASE_URL')
  }
  return config
}

function safeFileName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'album'
}

function extensionFromContentType(contentType: string | null) {
  const type = contentType?.split(';')[0]?.trim().toLowerCase()
  if (type === 'image/jpeg') return '.jpg'
  if (type === 'image/png') return '.png'
  if (type === 'image/webp') return '.webp'
  if (type === 'image/avif') return '.avif'
  return ''
}

function extensionFromUrl(url: string) {
  try {
    const extension = path.extname(new URL(url).pathname).toLowerCase()
    if (extension === '.jpeg') return '.jpg'
    return ['.jpg', '.png', '.webp', '.avif'].includes(extension) ? extension : ''
  } catch {
    return ''
  }
}

function contentTypeFromExtension(extension: string) {
  if (extension === '.png') return 'image/png'
  if (extension === '.webp') return 'image/webp'
  if (extension === '.avif') return 'image/avif'
  return 'image/jpeg'
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function localCover(albumId: string) {
  const baseName = safeFileName(albumId)
  for (const extension of ['.webp', '.jpg', '.png', '.avif']) {
    const filePath = path.join(albumCoverDir, `${baseName}${extension}`)
    if (await fileExists(filePath)) {
      return {
        bytes: new Uint8Array(await fs.readFile(filePath)),
        extension,
        contentType: contentTypeFromExtension(extension),
      }
    }
  }
  return null
}

async function downloadCover(url: string) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      },
    })
    if (!response.ok) throw new Error(`cover_download_http_${response.status}`)
    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg'
    if (!contentType.toLowerCase().startsWith('image/')) throw new Error(`invalid_image_content_type_${contentType}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === 0) throw new Error('empty_cover_response')
    return {
      bytes,
      extension: extensionFromContentType(contentType) || extensionFromUrl(url) || '.jpg',
      contentType,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: string | Uint8Array, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

function hmacHex(key: string | Uint8Array, value: string) {
  return createHmac('sha256', key).update(value).digest('hex')
}

function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return { amzDate: iso, dateStamp: iso.slice(0, 8) }
}

function signingKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, REGION)
  const serviceKey = hmac(regionKey, SERVICE)
  return hmac(serviceKey, 'aws4_request')
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function objectUrl(config: R2Config, key: string) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodePathSegment(config.bucket)}/${key.split('/').map(encodePathSegment).join('/')}`
}

function publicUrl(config: R2Config, key: string) {
  return `${config.publicBaseUrl}/${key.split('/').map(encodePathSegment).join('/')}`
}

async function uploadToR2(config: R2Config, asset: CoverAsset) {
  const url = objectUrl(config, asset.key)
  const parsed = new URL(url)
  const payloadHash = sha256Hex(asset.bytes)
  const { amzDate, dateStamp } = amzDates()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const canonicalHeaders = [
    `cache-control:public, max-age=31536000, immutable`,
    `content-length:${asset.bytes.byteLength}`,
    `content-type:${asset.contentType}`,
    `host:${parsed.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n'
  const signedHeaders = 'cache-control;content-length;content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = ['PUT', parsed.pathname, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'PUT',
    body: toBody(asset.bytes) as any,
    headers: {
      authorization,
      'cache-control': 'public, max-age=31536000, immutable',
      'content-length': String(asset.bytes.byteLength),
      'content-type': asset.contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  })
  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`r2_upload_http_${response.status}${errorText ? `_${errorText.slice(0, 160)}` : ''}`)
  }
  await response.body?.cancel().catch(() => undefined)
}

async function buildAsset(config: R2Config, album: AlbumCoverRow): Promise<CoverAsset | null> {
  if (!force && album.cover_local?.startsWith(`${config.publicBaseUrl}/album-covers/`)) return null
  const originalUrl = originalCoverByAlbumId.get(album.id)
  const source = await localCover(album.id) ?? (originalUrl ? await downloadCover(originalUrl) : null)
  if (!source) return null
  const fileName = `${safeFileName(album.id)}${source.extension}`
  const key = `album-covers/${fileName}`
  return {
    album,
    key,
    publicUrl: publicUrl(config, key),
    bytes: source.bytes,
    contentType: source.contentType,
  }
}

async function runPool<T, R>(items: T[], worker: (item: T) => Promise<R>) {
  const results: R[] = []
  let cursor = 0
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]
      results.push(await worker(item))
    }
  })
  await Promise.all(workers)
  return results
}

function ensureCoverRemoteColumn() {
  const db = getDatabase()
  const albumColumns = db.prepare('PRAGMA table_info(albums)').all() as Array<{ name: string }>
  if (albumColumns.length > 0 && !albumColumns.some((column) => column.name === 'cover_remote')) {
    db.prepare('ALTER TABLE albums ADD COLUMN cover_remote TEXT').run()
  }
}

async function main() {
  const config = getR2Config()
  ensureCoverRemoteColumn()
  const db = getDatabase()
  const albums = db.prepare('SELECT id, cover_local FROM albums ORDER BY release_date DESC').all() as AlbumCoverRow[]
  const update = db.prepare('UPDATE albums SET cover_local = ?, cover_remote = COALESCE(cover_remote, ?) WHERE id = ?')
  const updateRemoteOnly = db.prepare('UPDATE albums SET cover_remote = COALESCE(cover_remote, ?) WHERE id = ?')
  let uploaded = 0
  let skipped = 0
  let failed = 0

  console.log(`Preparing ${albums.length} album covers for R2 CDN ${config.publicBaseUrl}`)
  const results = await runPool(albums, async (album) => {
    try {
      const asset = await buildAsset(config, album)
      if (!asset) return { album, skipped: true as const }
      if (!dryRun) await uploadToR2(config, asset)
      return { album, asset }
    } catch (error) {
      return { album, error: error instanceof Error ? error.message : String(error) }
    }
  })

  for (const result of results) {
    if ('error' in result) {
      failed += 1
      console.warn(`✗ ${result.album.id}: ${result.error}`)
      continue
    }
    if ('skipped' in result) {
      if (!dryRun) updateRemoteOnly.run(originalCoverByAlbumId.get(result.album.id) ?? null, result.album.id)
      skipped += 1
      continue
    }
    uploaded += 1
    if (!dryRun) update.run(result.asset.publicUrl, originalCoverByAlbumId.get(result.album.id) ?? null, result.album.id)
    console.log(`${dryRun ? '↷' : '✓'} ${result.album.id} -> ${result.asset.publicUrl}`)
  }

  console.log(`Done. uploaded=${uploaded}, skipped=${skipped}, failed=${failed}${dryRun ? ' (dry-run)' : ''}`)
}

main().finally(() => closeDatabase()).catch((error) => {
  console.error(error)
  process.exit(1)
})
