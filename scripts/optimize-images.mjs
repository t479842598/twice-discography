import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

const roots = ['frontend/public', 'docs/screenshots']
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg'])

let imageCount = 0

function walk(directory) {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(entryPath)
      continue
    }
    if (imageExtensions.has(path.extname(entry.name).toLowerCase())) imageCount += 1
  }
}

for (const root of roots) walk(path.join(process.cwd(), root))

console.log(`Image check complete: ${imageCount} image assets found.`)
