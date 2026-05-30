import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { registerMetaRoutes } from './routes/meta.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function buildServer() {
  const app = Fastify({ logger: true })

  app.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
  })

  app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'https:', 'blob:'],
        connectSrc: ["'self'", 'https://www.google.com', 'https://www.bilibili.com'],
        frameSrc: [
          "'self'",
          'https://www.youtube.com',
          'https://www.youtube-nocookie.com',
          'https://player.bilibili.com',
          'https://music.163.com',
          'https://i.y.qq.com',
          'https://open.spotify.com',
          'https://embed.music.apple.com',
        ],
      },
    },
  })

  app.register(fastifyStatic, {
    root: path.resolve(__dirname, '../public'),
    prefix: process.env.STATIC_PREFIX ?? '/static/',
  })

  app.get('/health', async () => ({ ok: true }))
  app.register(registerMetaRoutes, { prefix: '/api/meta' })

  return app
}

async function main() {
  const app = buildServer()
  const port = Number(process.env.BACKEND_PORT ?? 3000)
  const host = process.env.BACKEND_HOST ?? '0.0.0.0'

  await app.listen({ port, host })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
