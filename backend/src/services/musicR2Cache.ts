import { createHash, createHmac } from 'node:crypto'
import path from 'node:path'
import {
  findMusicAssetByIdentity,
  markMusicAssetFailed,
  markMusicAssetReady,
  upsertPendingMusicAsset,
} from '../db/musicAssets.js'
import type { MusicCandidate, MusicSource, QualityTag, TrackMusicRecord } from './musicTypes.js'

const REGION = 'auto'
const SERVICE = 's3'
const DEFAULT_MIN_AUDIO_BYTES = 16 * 1024
const DEFAULT_MAX_CACHE_BYTES = Math.floor(8.5 * 1024 * 1024 * 1024)
const inFlightUploads = new Set<string>()

interface R2Config {
  accountId: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  publicBaseUrl: string
  missMode: 'background' | 'blocking'
  minAudioBytes: number
  maxCacheBytes: number
}

interface DownloadedAudio {
  bytes: Uint8Array
  contentType: string
  sizeBytes: number
}

interface UploadResult {
  etag?: string | null
}

function env(name: string) {
  return process.env[name]?.trim() ?? ''
}

export function getR2MusicConfig(): R2Config | null {
  if (env('MUSIC_R2_CACHE_ENABLED') !== 'true') return null

  const accountId = env('R2_ACCOUNT_ID')
  const accessKeyId = env('R2_ACCESS_KEY_ID')
  const secretAccessKey = env('R2_SECRET_ACCESS_KEY')
  const bucket = env('R2_BUCKET')
  const publicBaseUrl = env('R2_PUBLIC_BASE_URL').replace(/\/+$/, '')
  const minAudioBytes = Number.parseInt(env('MUSIC_R2_MIN_AUDIO_BYTES') || String(DEFAULT_MIN_AUDIO_BYTES), 10)
  const maxCacheBytes = Number.parseInt(env('MUSIC_R2_MAX_BYTES') || String(DEFAULT_MAX_CACHE_BYTES), 10)

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return null

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucket,
    publicBaseUrl,
    missMode: env('MUSIC_R2_CACHE_MISS_MODE') === 'blocking' ? 'blocking' : 'background',
    minAudioBytes: Number.isFinite(minAudioBytes) ? Math.max(minAudioBytes, 1) : DEFAULT_MIN_AUDIO_BYTES,
    maxCacheBytes: Number.isFinite(maxCacheBytes) ? Math.max(maxCacheBytes, 1) : DEFAULT_MAX_CACHE_BYTES,
  }
}

function sha256Hex(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

function hmac(key: string | Uint8Array, value: string) {
  return createHmac('sha256', key).update(value).digest()
}

function hmacHex(key: string | Uint8Array, value: string) {
  return createHmac('sha256', key).update(value).digest('hex')
}

function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8),
  }
}

function signingKey(secretAccessKey: string, dateStamp: string) {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const regionKey = hmac(dateKey, REGION)
  const serviceKey = hmac(regionKey, SERVICE)
  return hmac(serviceKey, 'aws4_request')
}

function encodePathSegment(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function objectUrl(config: R2Config, key: string) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodePathSegment(config.bucket)}/${key.split('/').map(encodePathSegment).join('/')}`
}

function bucketUrl(config: R2Config) {
  return `https://${config.accountId}.r2.cloudflarestorage.com/${encodePathSegment(config.bucket)}`
}

function publicUrl(config: R2Config, key: string) {
  return `${config.publicBaseUrl}/${key.split('/').map(encodePathSegment).join('/')}`
}

function safePathPart(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'unknown'
}

function extensionFromContentType(contentType: string) {
  const normalized = contentType.toLowerCase()
  if (normalized.includes('flac')) return 'flac'
  if (normalized.includes('mpeg') || normalized.includes('mp3')) return 'mp3'
  if (normalized.includes('mp4') || normalized.includes('m4a') || normalized.includes('aac')) return 'm4a'
  if (normalized.includes('ogg')) return 'ogg'
  if (normalized.includes('wav')) return 'wav'
  return null
}

function extensionFromUrl(url: string) {
  try {
    const ext = path.extname(new URL(url).pathname).replace(/^\./, '').toLowerCase()
    return ['flac', 'mp3', 'm4a', 'aac', 'ogg', 'wav'].includes(ext) ? ext : null
  } catch {
    return null
  }
}

export function buildMusicR2Key(candidate: MusicCandidate, contentType = '') {
  const extension = extensionFromContentType(contentType) ?? extensionFromUrl(candidate.audioUrl ?? '') ?? (candidate.quality.lossless ? 'flac' : 'mp3')
  return `music/${safePathPart(candidate.source)}/${safePathPart(candidate.providerId)}/${safePathPart(candidate.quality.tag)}.${extension}`
}

export function getMusicR2PublicUrl(candidate: MusicCandidate, contentType = '') {
  const config = getR2MusicConfig()
  if (!config) return null
  return publicUrl(config, buildMusicR2Key(candidate, contentType))
}

async function downloadAudio(audioUrl: string, minAudioBytes: number): Promise<DownloadedAudio> {
  const response = await fetch(audioUrl, {
    redirect: 'follow',
    headers: {
      'user-agent': 'twice-discography-r2-cache/1.0',
      accept: 'audio/*,*/*;q=0.8',
    },
  })

  if (!response.ok && response.status !== 206) {
    await response.body?.cancel().catch(() => undefined)
    throw new Error(`audio_download_http_${response.status}`)
  }

  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() || 'application/octet-stream'
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength < minAudioBytes) throw new Error(`audio_too_small_${bytes.byteLength}`)
  if (!/^audio\//i.test(contentType) && contentType !== 'application/octet-stream') {
    throw new Error(`invalid_audio_content_type_${contentType}`)
  }

  return {
    bytes,
    contentType,
    sizeBytes: bytes.byteLength,
  }
}

async function uploadToR2(config: R2Config, key: string, audio: DownloadedAudio): Promise<UploadResult> {
  const url = objectUrl(config, key)
  const parsed = new URL(url)
  const payloadHash = sha256Hex(audio.bytes)
  const { amzDate, dateStamp } = amzDates()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const canonicalUri = parsed.pathname
  const canonicalHeaders = [
    `content-length:${audio.sizeBytes}`,
    `content-type:${audio.contentType}`,
    `host:${parsed.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n'
  const signedHeaders = 'content-length;content-type;host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = ['PUT', canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign)
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const response = await fetch(url, {
    method: 'PUT',
    body: audio.bytes,
    headers: {
      authorization,
      'content-length': String(audio.sizeBytes),
      'content-type': audio.contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`r2_upload_http_${response.status}${errorText ? `_${errorText.slice(0, 120)}` : ''}`)
  }

  await response.body?.cancel().catch(() => undefined)
  return { etag: response.headers.get('etag') }
}

function signedR2GetHeaders(config: R2Config, parsed: URL) {
  const payloadHash = sha256Hex('')
  const { amzDate, dateStamp } = amzDates()
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const canonicalQuery = Array.from(parsed.searchParams.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  const canonicalHeaders = [
    `host:${parsed.host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${amzDate}`,
  ].join('\n') + '\n'
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date'
  const canonicalRequest = ['GET', parsed.pathname, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n')
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(canonicalRequest)].join('\n')
  const signature = hmacHex(signingKey(config.secretAccessKey, dateStamp), stringToSign)

  return {
    authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
}

function parseXmlTag(text: string, tag: string) {
  const match = text.match(new RegExp(`<${tag}>([^<]*)</${tag}>`))
  return match?.[1] ?? ''
}

function parseXmlSizes(text: string) {
  return Array.from(text.matchAll(/<Size>(\d+)<\/Size>/g), (match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)
}

async function getR2PrefixSizeBytes(config: R2Config, prefix = 'music/') {
  let continuationToken = ''
  let total = 0

  do {
    const parsed = new URL(bucketUrl(config))
    parsed.searchParams.set('list-type', '2')
    parsed.searchParams.set('prefix', prefix)
    if (continuationToken) parsed.searchParams.set('continuation-token', continuationToken)

    const response = await fetch(parsed, {
      method: 'GET',
      headers: signedR2GetHeaders(config, parsed),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`r2_usage_http_${response.status}${errorText ? `_${errorText.slice(0, 120)}` : ''}`)
    }

    const text = await response.text()
    total += parseXmlSizes(text).reduce((sum, size) => sum + size, 0)
    continuationToken = parseXmlTag(text, 'NextContinuationToken')
  } while (continuationToken)

  return total
}

export async function cacheMusicCandidateToR2(candidate: MusicCandidate, track?: TrackMusicRecord | null) {
  const config = getR2MusicConfig()
  if (!config || !candidate.audioUrl || !candidate.playable) return null

  const qualityTag = candidate.quality.tag as QualityTag
  const identity = `${candidate.source}:${candidate.providerId}:${qualityTag}`
  const existing = findMusicAssetByIdentity(candidate.source, candidate.providerId, qualityTag)
  if (existing?.status === 'ready') return existing
  if (inFlightUploads.has(identity)) return existing

  inFlightUploads.add(identity)
  const initialKey = buildMusicR2Key(candidate)
  upsertPendingMusicAsset({
    id: identity,
    trackId: track?.id ?? null,
    source: candidate.source,
    providerId: candidate.providerId,
    qualityTag,
    r2Key: initialKey,
    publicUrl: publicUrl(config, initialKey),
  })

  try {
    const audio = await downloadAudio(candidate.audioUrl, config.minAudioBytes)
    const currentSizeBytes = await getR2PrefixSizeBytes(config)
    if (currentSizeBytes + audio.sizeBytes > config.maxCacheBytes) {
      throw new Error(`r2_cache_limit_exceeded_${currentSizeBytes + audio.sizeBytes}_of_${config.maxCacheBytes}`)
    }

    const finalKey = buildMusicR2Key(candidate, audio.contentType)
    upsertPendingMusicAsset({
      id: identity,
      trackId: track?.id ?? null,
      source: candidate.source,
      providerId: candidate.providerId,
      qualityTag,
      r2Key: finalKey,
      publicUrl: publicUrl(config, finalKey),
    })
    const upload = await uploadToR2(config, finalKey, audio)
    markMusicAssetReady({
      source: candidate.source,
      providerId: candidate.providerId,
      qualityTag,
      etag: upload.etag,
      contentType: audio.contentType,
      sizeBytes: audio.sizeBytes,
    })
    return findMusicAssetByIdentity(candidate.source, candidate.providerId, qualityTag)
  } catch (error) {
    markMusicAssetFailed({
      source: candidate.source,
      providerId: candidate.providerId,
      qualityTag,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  } finally {
    inFlightUploads.delete(identity)
  }
}

export function maybeCacheMusicCandidate(candidate: MusicCandidate | null | undefined, track?: TrackMusicRecord | null) {
  const config = getR2MusicConfig()
  if (!config || !candidate?.audioUrl || !candidate.playable) return null

  if (config.missMode === 'blocking') {
    return cacheMusicCandidateToR2(candidate, track)
  }

  void cacheMusicCandidateToR2(candidate, track).catch(() => undefined)
  return null
}

export function isR2MusicCacheBlocking() {
  return getR2MusicConfig()?.missMode === 'blocking'
}
