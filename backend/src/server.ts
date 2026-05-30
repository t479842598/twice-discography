import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import fastifyStatic from '@fastify/static'
import { registerCatalogRoutes } from './routes/catalog.js'
import { registerMetaRoutes } from './routes/meta.js'
import { registerMusicRoutes } from './routes/music.js'
import { registerTrackRoutes } from './routes/tracks.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export function buildServer() {
  const app = Fastify({ logger: true })
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')

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
        connectSrc: [
          "'self'",
          'https://www.google.com',
          'https://www.bilibili.com',
          'https://api.qijieya.cn',
          'https://tang.api.s01s.cn',
          'https://kw-api.cenguigui.cn',
          'https://apicx.asia',
          'https://isure6.stream.qqmusic.qq.com',
          'https://kw-lv.kuwo.cn',
          'https://hk.stream.music.joox.com',
        ],
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

  if (fs.existsSync(frontendDist)) {
    app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      decorateReply: false,
    })
  }

  app.get('/health', async () => ({ ok: true }))
  app.register(registerCatalogRoutes, { prefix: '/api' })
  app.register(registerMetaRoutes, { prefix: '/api/meta' })
  app.register(registerMusicRoutes, { prefix: '/api/music' })
  app.register(registerTrackRoutes, { prefix: '/api/tracks' })

  if (fs.existsSync(frontendDist)) {
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/') || request.raw.url === '/health') {
        return reply.code(404).send({ error: 'not_found' })
      }

      return reply.type('text/html; charset=utf-8').send(fs.createReadStream(path.join(frontendDist, 'index.html')))
    })
  }

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


