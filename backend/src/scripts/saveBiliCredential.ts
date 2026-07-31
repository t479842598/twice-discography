import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import { closeDatabase, ensureRuntimeMigrations } from '../db/database.js'
import { getBiliCredentialStatus, saveBiliCredential } from '../services/biliCredential.js'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(scriptDirectory, '../../..')

dotenv.config({ path: path.join(projectRoot, '.env') })
dotenv.config({ path: path.join(projectRoot, '.env.production'), override: true })

async function main() {
  const cookie = await readStandardInput()
  if (!cookie.trim()) throw new Error('Cookie input is empty')

  ensureRuntimeMigrations()
  saveBiliCredential(cookie)
  const status = getBiliCredentialStatus()
  if (!status.usable) throw new Error(status.problem || 'Credential could not be read after saving')

  // Never print Cookie content, the encryption key, or ciphertext.
  console.log(JSON.stringify({
    configured: status.configured,
    usable: status.usable,
    encryptionVersion: status.encryptionVersion,
  }))
}

function readStandardInput() {
  return new Promise<string>((resolve, reject) => {
    let value = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      value += chunk
      if (Buffer.byteLength(value, 'utf8') > 64 * 1024) {
        reject(new Error('Cookie input exceeds the maximum permitted size'))
        process.stdin.destroy()
      }
    })
    process.stdin.on('end', () => resolve(value))
    process.stdin.on('error', reject)
  })
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
  .finally(() => closeDatabase())
