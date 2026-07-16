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
  const signedHeaders = ['content-type', 'host', ...Object.keys(metadataHeaders)].sort().join(';')

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

export async function createR2PresignedDeleteUrl(options: Omit<R2PresignOptions, 'contentType' | 'metadata'>) {
  const expiresSeconds = Math.min(Math.max(options.expiresSeconds ?? 900, 60), 3600)
  const { amzDate, dateStamp } = amzDates()
  const region = 'auto'
  const service = 's3'
  const host = `${options.accountId}.r2.cloudflarestorage.com`
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const canonicalUri = `/${encodePath(options.bucketName)}/${encodePath(options.key)}`
  const signedHeaders = 'host'

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
    headers: {},
    expiresAt: new Date(Date.now() + expiresSeconds * 1000).toISOString()
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
