export function realDataOnly() {
  if (process.env.NUXT_REAL_DATA_ONLY === 'false' || process.env.NUXT_PUBLIC_REAL_DATA_ONLY === 'false') return false
  if (process.env.NODE_ENV === 'production') return true
  return process.env.NUXT_REAL_DATA_ONLY === 'true'
    || process.env.NUXT_PUBLIC_REAL_DATA_ONLY === 'true'
}

export function containsMockMedia(value: unknown): boolean {
  if (typeof value === 'string') {
    return value.includes('picsum.photos')
  }

  if (Array.isArray(value)) {
    return value.some(item => containsMockMedia(item))
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(item => containsMockMedia(item))
  }

  return false
}
