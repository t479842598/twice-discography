import dotenv from 'dotenv'
import { closeDatabase } from '../db/database.js'
import { listTrackMusicRecords } from '../db/tracks.js'
import { getPlaybackCandidate } from '../services/musicProviders.js'
import { cacheMusicCandidateToR2, getR2MusicConfig } from '../services/musicR2Cache.js'

dotenv.config()

function numberArg(name: string, fallback: number) {
  const value = process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1]
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) ? Math.max(parsed, 1) : fallback
}

async function warmTrack(track: ReturnType<typeof listTrackMusicRecords>[number]) {
  const result = await getPlaybackCandidate(track, {
    quality: 'best',
    jooxToken: process.env.JOOX_TOKEN,
  })

  if (!result.selected?.audioUrl) {
    return { id: track.id, status: 'skipped', message: 'no playable source' }
  }

  const asset = await cacheMusicCandidateToR2(result.selected, track)
  if (!asset || asset.status !== 'ready') {
    return { id: track.id, status: 'failed', message: 'upload failed' }
  }

  return { id: track.id, status: 'ready', message: asset.publicUrl }
}

async function main() {
  const config = getR2MusicConfig()
  if (!config) {
    throw new Error('R2 music cache is not configured. Set MUSIC_R2_CACHE_ENABLED=true and R2_* env vars first.')
  }

  const concurrency = numberArg('concurrency', 2)
  const limit = numberArg('limit', Number.MAX_SAFE_INTEGER)
  const tracks = listTrackMusicRecords().slice(0, limit)
  const summary = { ready: 0, failed: 0, skipped: 0 }
  let cursor = 0

  async function worker() {
    while (cursor < tracks.length) {
      const track = tracks[cursor]
      cursor += 1
      const result = await warmTrack(track).catch((error) => ({
        id: track.id,
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
      }))
      summary[result.status as keyof typeof summary] += 1
      console.log(`[${result.status}] ${result.id}: ${result.message}`)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, tracks.length) }, () => worker()))
  console.log(`Done. ready=${summary.ready} failed=${summary.failed} skipped=${summary.skipped}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => {
    closeDatabase()
  })
