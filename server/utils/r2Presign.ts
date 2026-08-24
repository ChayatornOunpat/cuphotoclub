const encoder = new TextEncoder()

function hex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  return [...view].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))
}

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, value: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(value)))
}

function encodeRfc3986(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  )
}

function encodePath(value: string) {
  return value.split('/').map(encodeRfc3986).join('/')
}

function amzDates(now = new Date()) {
  const iso = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  return {
    amzDate: iso,
    dateStamp: iso.slice(0, 8)
  }
}

export interface R2PresignOptions {
  accountId: string
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
  key: string
  contentType: string
  metadata?: Record<string, string>
  expiresSeconds?: number
  // When set, `content-length` becomes a SIGNED header, so the URL accepts a
  // body of exactly this size and nothing else. Without it a presigned PUT is
  // bounded only by R2's own 5 GB limit and can be replayed until it expires —
  // tolerable behind an admin session, not on a link anyone can open.
  //
  // Deliberately NOT returned in `headers`: Content-Length is a forbidden
  // header that the browser sets itself from the body, so it already matches.
  contentLength?: number
}

export async function createR2PresignedPutUrl(options: R2PresignOptions) {
  const expiresSeconds = Math.min(Math.max(options.expiresSeconds ?? 900, 60), 3600)
  const { amzDate, dateStamp } = amzDates()
  const region = 'auto'
  const service = 's3'
  const host = `${options.accountId}.r2.cloudflarestorage.com`
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalUri = `/${encodePath(options.bucketName)}/${encodePath(options.key)}`
  const metadataHeaders = Object.fromEntries(
    Object.entries(options.metadata || {})
      .filter(([, value]) => value)
      .map(([key, value]) => [`x-amz-meta-${key.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`, value])
  )
  const boundLength = Number.isFinite(options.contentLength) && (options.contentLength ?? 0) > 0
    ? String(Math.trunc(options.contentLength as number))
    : ''
  const signedHeaders = [
    'content-type',
    'host',
    ...(boundLength ? ['content-length'] : []),
    ...Object.keys(metadataHeaders)
  ].sort().join(';')

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${options.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders
  }
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')

  const canonicalHeaders = [
    `content-type:${options.contentType}`,
    `host:${host}`,
    ...(boundLength ? [`content-length:${boundLength}`] : []),
    ...Object.entries(metadataHeaders).map(([key, value]) => `${key}:${value}`)
  ].sort().join('\n') + '\n'

  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  const kDate = await hmac(encoder.encode(`AWS4${options.secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, region)
  const kService = await hmac(kRegion, service)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = hex(await hmac(kSigning, stringToSign))

  return {
    url: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    headers: {
      'Content-Type': options.contentType,
      ...metadataHeaders
    },
    expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString()
  }
}

// Precomputed, key-independent part of an R2 SigV4 delete signature. The AWS
// signing-key chain (kDate→kRegion→kService→kSigning) depends only on the
// secret, date, region, and service — all identical across a batch — so a
// caller signing many keys at once (bulk delete/empty-trash) derives this ONCE
// and reuses it, turning ~5 HMACs per key into ~1. This is what keeps a
// 250-key delete session under the Worker CPU limit.
export interface R2DeleteSigner {
  accountId: string
  bucketName: string
  accessKeyId: string
  amzDate: string
  dateStamp: string
  credentialScope: string
  kSigning: Uint8Array<ArrayBuffer>
}

const PRESIGN_REGION = 'auto'
const PRESIGN_SERVICE = 's3'

export async function createR2DeleteSigner(
  options: Pick<R2PresignOptions, 'accountId' | 'bucketName' | 'accessKeyId' | 'secretAccessKey'>,
  now = new Date()
): Promise<R2DeleteSigner> {
  const { amzDate, dateStamp } = amzDates(now)
  const credentialScope = `${dateStamp}/${PRESIGN_REGION}/${PRESIGN_SERVICE}/aws4_request`

  const kDate = await hmac(encoder.encode(`AWS4${options.secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, PRESIGN_REGION)
  const kService = await hmac(kRegion, PRESIGN_SERVICE)
  const kSigning = await hmac(kService, 'aws4_request')

  return {
    accountId: options.accountId,
    bucketName: options.bucketName,
    accessKeyId: options.accessKeyId,
    amzDate,
    dateStamp,
    credentialScope,
    kSigning
  }
}

// Per-key portion of a presigned delete URL. Given a signer, this does only the
// per-key work: build the canonical request, hash it, and one final HMAC.
export async function signR2PresignedDeleteUrl(signer: R2DeleteSigner, key: string, expiresSeconds = 900) {
  const clampedExpires = Math.min(Math.max(expiresSeconds, 60), 3600)
  const host = `${signer.accountId}.r2.cloudflarestorage.com`
  const canonicalUri = `/${encodePath(signer.bucketName)}/${encodePath(key)}`
  const signedHeaders = 'host'

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${signer.accessKeyId}/${signer.credentialScope}`,
    'X-Amz-Date': signer.amzDate,
    'X-Amz-Expires': String(clampedExpires),
    'X-Amz-SignedHeaders': signedHeaders
  }
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, value]) => `${encodeRfc3986(k)}=${encodeRfc3986(value)}`)
    .join('&')

  const canonicalHeaders = `host:${host}\n`
  const canonicalRequest = [
    'DELETE',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    signer.amzDate,
    signer.credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  const signature = hex(await hmac(signer.kSigning, stringToSign))

  return {
    url: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    headers: {},
    expiresAt: new Date(Date.now() + clampedExpires * 1000).toISOString()
  }
}

// Single-key convenience wrapper — derives a fresh signer, then signs. Callers
// deleting many keys should build one signer via createR2DeleteSigner() and
// call signR2PresignedDeleteUrl() per key instead.
export async function createR2PresignedDeleteUrl(options: Omit<R2PresignOptions, 'contentType' | 'metadata'>) {
  const signer = await createR2DeleteSigner(options)
  return signR2PresignedDeleteUrl(signer, options.key, options.expiresSeconds ?? 900)
}

// Server-side object copy, used when consolidating submissions into an album.
//
// The NuxtHub blob API has no copy, and the obvious getArrayBuffer() + put()
// pulls every byte of a multi-megabyte image through Worker memory and back —
// a batch of those is the same resource ceiling that produced the Error 1102
// incidents this codebase already carries scar tissue for. S3's
// `x-amz-copy-source` makes R2 do the copy internally; no bytes cross the Worker.
//
// Presigned rather than a signed request so it reuses the exact pattern above;
// the caller is the Worker, and it must send the signed header verbatim.
export async function createR2PresignedCopyUrl(
  options: Omit<R2PresignOptions, 'contentType' | 'metadata'> & { sourceKey: string }
) {
  const expiresSeconds = Math.min(Math.max(options.expiresSeconds ?? 900, 60), 3600)
  const { amzDate, dateStamp } = amzDates()
  const host = `${options.accountId}.r2.cloudflarestorage.com`
  const credentialScope = `${dateStamp}/${PRESIGN_REGION}/${PRESIGN_SERVICE}/aws4_request`
  const canonicalUri = `/${encodePath(options.bucketName)}/${encodePath(options.key)}`
  // Must be byte-identical between the signature and the request we send.
  const copySource = `/${encodePath(options.bucketName)}/${encodePath(options.sourceKey)}`
  const signedHeaders = 'host;x-amz-copy-source'

  const query: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Content-Sha256': 'UNSIGNED-PAYLOAD',
    'X-Amz-Credential': `${options.accessKeyId}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': signedHeaders
  }
  const canonicalQuery = Object.entries(query)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${encodeRfc3986(key)}=${encodeRfc3986(value)}`)
    .join('&')

  const canonicalHeaders = `host:${host}\nx-amz-copy-source:${copySource}\n`
  const canonicalRequest = [
    'PUT',
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD'
  ].join('\n')

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    await sha256(canonicalRequest)
  ].join('\n')

  const kDate = await hmac(encoder.encode(`AWS4${options.secretAccessKey}`), dateStamp)
  const kRegion = await hmac(kDate, PRESIGN_REGION)
  const kService = await hmac(kRegion, PRESIGN_SERVICE)
  const kSigning = await hmac(kService, 'aws4_request')
  const signature = hex(await hmac(kSigning, stringToSign))

  return {
    url: `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    // Default metadata directive is COPY, so content-type carries over.
    headers: { 'x-amz-copy-source': copySource }
  }
}

// Copy one object inside the bucket. Throws with R2's own message on failure so
// a partial consolidation says which key broke.
export async function copyR2Object(sourceKey: string, destKey: string) {
  const config = assertR2DirectUploadConfig()
  const signed = await createR2PresignedCopyUrl({ ...config, key: destKey, sourceKey })
  const response = await fetch(signed.url, { method: 'PUT', headers: signed.headers })
  if (!response.ok) {
    // R2's body can carry bucket and account detail, so it goes to the log
    // rather than to whoever triggered the copy.
    const detail = await response.text().catch(() => '')
    console.error('r2 copy failed', {
      sourceKey,
      destKey,
      status: response.status,
      detail: detail.slice(0, 500)
    })
    throw createError({
      statusCode: 502,
      message: `Could not copy ${sourceKey} (R2 returned ${response.status}).`
    })
  }
}

export function r2DirectUploadConfig() {
  const config = useRuntimeConfig()
  const direct = config.r2DirectUpload as {
    accountId?: string
    bucketName?: string
    accessKeyId?: string
    secretAccessKey?: string
  }

  return {
    accountId: direct.accountId || process.env.NUXT_R2_ACCOUNT_ID || '',
    bucketName: direct.bucketName || process.env.NUXT_R2_BUCKET_NAME || '',
    accessKeyId: direct.accessKeyId || process.env.NUXT_R2_ACCESS_KEY_ID || '',
    secretAccessKey: direct.secretAccessKey || process.env.NUXT_R2_SECRET_ACCESS_KEY || ''
  }
}

export function assertR2DirectUploadConfig() {
  const config = r2DirectUploadConfig()
  const missing = Object.entries(config)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length) {
    throw createError({
      statusCode: 501,
      message: `Direct R2 upload is not configured. Missing: ${missing.join(', ')}.`
    })
  }

  return config
}
