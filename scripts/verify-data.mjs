import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const rootDir = process.cwd()
const databasePath = process.env.DATABASE_PATH
  ? path.resolve(rootDir, process.env.DATABASE_PATH)
  : path.join(rootDir, 'backend', 'data', 'twice.db')

if (!existsSync(databasePath)) {
  const seed = spawnSync('pnpm', ['--filter', 'backend', 'seed'], {
    cwd: rootDir,
    shell: process.platform === 'win32',
    stdio: 'inherit',
  })

  if (seed.status !== 0) {
    process.exit(seed.status ?? 1)
  }
}

const require = createRequire(import.meta.url)
const Database = require('../backend/node_modules/better-sqlite3')
const db = new Database(databasePath, { readonly: true })

const one = (sql, params = []) => db.prepare(sql).get(...params)
const all = (sql, params = []) => db.prepare(sql).all(...params)

const checks = [
  ['albums >= 90', () => one('SELECT COUNT(*) AS count FROM albums').count >= 90],
  ['tracks >= 300', () => one('SELECT COUNT(*) AS count FROM tracks').count >= 300],
  ['members = 9', () => one('SELECT COUNT(*) AS count FROM members').count === 9],
  ['all albums have covers', () => one("SELECT COUNT(*) AS count FROM albums WHERE COALESCE(cover_local, '') = ''").count === 0],
  ['all members have photos', () => one("SELECT COUNT(*) AS count FROM members WHERE COALESCE(photo_local, '') = ''").count === 0],
  ['ENEMY album exists', () => one("SELECT COUNT(*) AS count FROM albums WHERE name_en = 'ENEMY'").count > 0],
  ['MISAMO PLAY album exists', () => one("SELECT COUNT(*) AS count FROM albums WHERE name_en = 'PLAY'").count > 0],
  ['solo tracks exist', () => one("SELECT COUNT(*) AS count FROM tracks WHERE category = 'solo'").count > 0],
  ['unit tracks exist', () => one("SELECT COUNT(*) AS count FROM tracks WHERE category IN ('unit', 'misamo')").count > 0],
  ['CF tracks exist', () => one("SELECT COUNT(*) AS count FROM tracks WHERE category = 'cf'").count > 0],
  ['cover tracks exist', () => one("SELECT COUNT(*) AS count FROM tracks WHERE category IN ('cover', 'predebut')").count > 0],
  [
    'THIS IS FOR title track is correct',
    () =>
      all(
        `SELECT tracks.title_en
         FROM tracks
         JOIN albums ON albums.id = tracks.album_id
         WHERE albums.name_en IN ('THIS IS FOR', 'THIS IS FOR (DELUXE)')
           AND tracks.is_title = 1`,
      ).every((track) => track.title_en === 'THIS IS FOR'),
  ],
  [
    'FANCY has preferred QQ source',
    () => one("SELECT music_square_preferred AS source FROM tracks WHERE id = 'fancy'").source === 'qq',
  ],
  [
    'Blink has fixed vocal source ids',
    () => {
      const track = one("SELECT qq_song_mid, netease_song_id, kuwo_rid FROM tracks WHERE title_en = 'Blink'")
      return track?.qq_song_mid === '003JTKt01gi5jR' && track?.netease_song_id === '3338126483' && track?.kuwo_rid === '501737982'
    },
  ],
]

const failures = checks.filter(([, check]) => !check()).map(([label]) => label)

db.close()

if (failures.length) {
  console.error(`Data verification failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}

console.log('Data verification passed.')
