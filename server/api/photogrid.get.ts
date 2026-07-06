function normalizeImageSrc(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:)?\/\//.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }
  return `/images/${trimmed.replace(/^\/+/, '')}`
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const count = Math.min(Math.max(Number(query.count) || 250, 1), 500)

  const albums = (await albumStore.list()).filter(album => album.visibility === 'public')

  const keys = new Set<string>()
  for (const album of albums) {
    const cover = normalizeImageSrc(album.coverSrc)
    if (cover) keys.add(cover)
    for (const row of album.rows) {
      for (const cell of row.cells) {
        if (cell.type !== 'image') continue
        const src = normalizeImageSrc(cell.src)
        if (src) keys.add(src)
      }
    }
  }

  const pool = Array.from(keys)

  // Partial Fisher-Yates: only shuffle as many slots as we need to sample.
  const take = Math.min(count, pool.length)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }

  return { images: pool.slice(0, take) }
})
