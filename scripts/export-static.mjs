import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const rootDir = process.cwd()
const outputDir = path.join(rootDir, 'static-export')

const build = spawnSync('pnpm', ['--filter', 'frontend', 'build'], {
  cwd: rootDir,
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

if (build.status !== 0) {
  process.exit(build.status ?? 1)
}

rmSync(outputDir, { recursive: true, force: true })
mkdirSync(outputDir, { recursive: true })
cpSync(path.join(rootDir, 'frontend', 'dist'), outputDir, { recursive: true })
writeFileSync(path.join(outputDir, '.nojekyll'), '')
writeFileSync(path.join(outputDir, '_redirects'), '/* /index.html 200\n')

console.log(`Static export written to ${outputDir}`)
