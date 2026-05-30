import { existsSync } from 'node:fs'
import path from 'node:path'

const embedDir = path.join(process.cwd(), 'musicsquare-embed')

if (!existsSync(embedDir)) {
  console.log('MusicSquare embed folder not found; backend API integration is used directly.')
  process.exit(0)
}

console.log('MusicSquare API integration is handled by backend services; no iframe bundle is required.')
