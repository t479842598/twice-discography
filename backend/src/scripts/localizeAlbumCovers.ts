import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { closeDatabase, getDatabase } from '../db/database.js'

interface AlbumCoverRow {
  id: string
  cover_local: string | null
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const backendRoot = path.resolve(__dirname, '../..')
const repoRoot = path.resolve(backendRoot, '..')

dotenv.config({ path: path.join(repoRoot, '.env') })
dotenv.config()

const publicDir = path.join(backendRoot, 'public')
const albumCoverDir = path.join(publicDir, 'albums')
const staticPrefix = (process.env.STATIC_PREFIX || '/static').replace(/\/$/, '')
const force = process.argv.includes('--force')
const dryRun = process.argv.includes('--dry-run')
const concurrency = Number(process.env.COVER_DOWNLOAD_CONCURRENCY || 6)

function isRemoteUrl(value: string | null): value is string {
  return Boolean(value && /^https?:\/\//i.test(value))
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
    const pathname = new URL(url).pathname.toLowerCase()
    const extension = path.extname(pathname)
    return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(extension) ? (extension === '.jpeg' ? '.jpg' : extension) : ''
  } catch {
    return ''
  }
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function downloadCover(album: AlbumCoverRow) {
  if (!isRemoteUrl(album.cover_local)) return { skipped: true, album, reason: 'not_remote' }

  const baseName = safeFileName(album.id)
  const existingExtensions = ['.webp', '.jpg', '.png', '.avif']
  if (!force) {
    for (const extension of existingExtensions) {
      const existingPath = path.join(albumCoverDir, `${baseName}${extension}`)
      if (await fileExists(existingPath)) {
        return { album, localUrl: `${staticPrefix}/albums/${baseName}${extension}`, skipped: true, reason: 'exists' }
      }
    }
  }

  if (dryRun) return { album, localUrl: `${staticPrefix}/albums/${baseName}${extensionFromUrl(album.cover_local) || '.jpg'}`, skipped: true, reason: 'dry_run' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30000)
  try {
    const response = await fetch(album.cover_local, {
      signal: controller.signal,
      headers: {
        accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/125 Safari/537.36',
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type')
    if (contentType && !contentType.toLowerCase().startsWith('image/')) throw new Error(`Unexpected content-type ${contentType}`)
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0) throw new Error('empty_response')

    const extension = extensionFromContentType(contentType) || extensionFromUrl(album.cover_local) || '.jpg'
    const fileName = `${baseName}${extension}`
    const filePath = path.join(albumCoverDir, fileName)
    await fs.writeFile(filePath, bytes)
    return { album, localUrl: `${staticPrefix}/albums/${fileName}`, bytes: bytes.length, skipped: false }
  } finally {
    clearTimeout(timeout)
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

async function main() {
  await fs.mkdir(albumCoverDir, { recursive: true })
  const db = getDatabase()
  const albums = db.prepare("SELECT id, cover_local FROM albums WHERE cover_local LIKE 'http%' ORDER BY release_date DESC").all() as AlbumCoverRow[]
  if (albums.length === 0) {
    console.log('No remote album covers found.')
    return
  }

  console.log(`Found ${albums.length} remote album covers.`)
  const update = db.prepare('UPDATE albums SET cover_local = ? WHERE id = ?')
  let localized = 0
  let skipped = 0
  let failed = 0

  const results = await runPool(albums, async (album) => {
    try {
      return await downloadCover(album)
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
    if (result.localUrl) {
      if (!dryRun) update.run(result.localUrl, result.album.id)
      localized += 1
      console.log(`${result.skipped ? '↷' : '✓'} ${result.album.id} -> ${result.localUrl}`)
    } else {
      skipped += 1
    }
  }

  console.log(`Done. localized=${localized}, skipped=${skipped}, failed=${failed}${dryRun ? ' (dry-run)' : ''}`)
}

main().finally(() => closeDatabase()).catch((error) => {
  console.error(error)
  process.exit(1)
})
