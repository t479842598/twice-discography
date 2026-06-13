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
import { registerMvRoutes } from './routes/mv.js'
import { registerTrackRoutes } from './routes/tracks.js'
import { registerAdminRoutes } from './routes/admin.js'
import { ensureRuntimeMigrations } from './db/database.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.resolve(__dirname, '../../.env') })
// Production override: .env.production values take precedence over .env
dotenv.config({ path: path.resolve(__dirname, '../../.env.production'), override: true })
dotenv.config()

function staticCacheControl(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/')
  if (/\.(?:avif|webp|png|jpe?g|gif|svg|ico|woff2?|ttf|otf)$/i.test(normalized)) {
    return 'public, max-age=31536000, immutable'
  }
  if (/\/assets\/.*\.(?:js|css)$/i.test(normalized)) {
    return 'public, max-age=31536000, immutable'
  }
  if (/\.(?:js|css)$/i.test(normalized)) {
    return 'public, max-age=86400'
  }
  return 'public, max-age=3600'
}

function setStaticCacheHeaders(res: { setHeader: (name: string, value: string) => void }, filePath: string) {
  res.setHeader('Cache-Control', staticCacheControl(filePath))
}

export function buildServer() {
  const app = Fastify({ logger: true })
  const frontendDist = path.resolve(__dirname, '../../frontend/dist')
  const serveFrontend = process.env.SERVE_FRONTEND !== 'false'

  ensureRuntimeMigrations()

  // 支持多个前端域名（用于前后端分离部署）
  const frontendOrigins = process.env.FRONTEND_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || []
  const corsOrigins = process.env.CORS_ORIGIN?.split(',').map(o => o.trim()).filter(Boolean) || []
  const localDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000', 'http://127.0.0.1:3000']
  const allowedOrigins = [...new Set([...frontendOrigins, ...corsOrigins, ...localDevOrigins])]
  const optionalOrigin = (value?: string) => {
    if (!value) return ''
    try {
      return new URL(value).origin
    } catch {
      return ''
    }
  }
  const connectOrigins = [...new Set([
    optionalOrigin(process.env.VITE_API_BASE),
    optionalOrigin(process.env.MV_PROXY_BASE_URL),
    ...allowedOrigins,
  ].filter(Boolean))]

  app.register(cors, {
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
    credentials: true,
  })

  app.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
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
          'https://twice-discography.onrender.com',
          ...connectOrigins,
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
    setHeaders: setStaticCacheHeaders,
  })

  // 只在单体部署模式下提供前端静态文件
  if (serveFrontend && fs.existsSync(frontendDist)) {
    app.register(fastifyStatic, {
      root: frontendDist,
      prefix: '/',
      decorateReply: false,
      setHeaders: setStaticCacheHeaders,
    })
    app.log.info('前端静态文件服务已启用（单体部署模式）')
  } else if (serveFrontend) {
    app.log.warn('SERVE_FRONTEND=true 但前端构建目录不存在，请先运行 pnpm build:frontend')
  } else {
    app.log.info('前端静态文件服务已禁用（前后端分离模式）')
  }

  app.get('/health', async () => ({ ok: true }))
  app.register(registerCatalogRoutes, { prefix: '/api' })
  app.register(registerMetaRoutes, { prefix: '/api/meta' })
  app.register(registerMusicRoutes, { prefix: '/api/music' })
  app.register(registerMvRoutes, { prefix: '/api/mv' })
  app.register(registerTrackRoutes, { prefix: '/api/tracks' })
  app.register(registerAdminRoutes, { prefix: '/api/admin' })

  // 只在单体部署模式下设置 SPA 回退
  if (serveFrontend && fs.existsSync(frontendDist)) {
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




