import type { FastifyInstance } from 'fastify'
import {
  getAlbum,
  getMember,
  getOverview,
  getTrack,
  listAlbums,
  listCfs,
  listCovers,
  listMembers,
  listTracks,
  searchCatalog,
} from '../db/catalog.js'

function parseYear(value: unknown) {
  const year = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(year) ? year : undefined
}

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get('/catalog/overview', async () => getOverview())

  app.get('/albums', async () => ({ albums: listAlbums() }))

  app.get('/albums/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const album = getAlbum(id)
    if (!album) return reply.code(404).send({ error: 'album_not_found' })

    return { album }
  })

  app.get('/tracks', async (request) => {
    const query = request.query as { category?: string; year?: string; q?: string }
    return {
      tracks: listTracks({
        category: query.category,
        year: parseYear(query.year),
        q: query.q,
      }),
    }
  })

  app.get('/tracks/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const track = getTrack(id)
    if (!track) return reply.code(404).send({ error: 'track_not_found' })

    return { track }
  })

  app.get('/members', async () => ({ members: listMembers() }))

  app.get('/members/:id', async (request, reply) => {
    const { id } = request.params as { id: string }
    const member = getMember(id)
    if (!member) return reply.code(404).send({ error: 'member_not_found' })

    return { member }
  })

  app.get('/cfs', async () => ({ cfs: listCfs() }))

  app.get('/covers', async () => ({ covers: listCovers() }))

  app.get('/search', async (request, reply) => {
    const query = request.query as { q?: string }
    const q = query.q?.trim()
    if (!q) return reply.code(400).send({ error: 'missing_query' })

    return {
      query: q,
      results: searchCatalog(q),
    }
  })
}
