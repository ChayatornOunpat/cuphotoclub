export function sanitizeUploadPrefix(value: string) {
  return value.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'covers'
}

export function sanitizeUploadExt(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

export function sanitizeUploadHash(value: string) {
  const hash = value.toLowerCase().replace(/[^a-f0-9]/g, '')
  return hash.length >= 16 ? hash : ''
}

export function hashedUploadKey(prefix: string, hash: string, ext: string) {
  const safePrefix = sanitizeUploadPrefix(prefix)
  const safeHash = sanitizeUploadHash(hash)
  if (!safeHash) return ''
  return `${safePrefix}/${safeHash}.${sanitizeUploadExt(ext)}`
}
