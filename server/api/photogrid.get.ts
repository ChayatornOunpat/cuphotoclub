function normalizeImageSrc(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^(https?:)?\/\//.test(trimmed) || trimmed.startsWith('/') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed
  }
  return `/images/${trimmed.replace(/^\/+/, '')}`
}

export interface PhotoGridImage {
  src: string
  albumId: string
  albumTitle: string
  albumCover: string
  albumDate: string
  photoCount: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const count = Math.min(Math.max(Number(query.count) || 250, 1), 500)

  const albums = (await albumStore.list()).filter(album => album.visibility === 'public')

  // Build enriched image entries with album association
  const pool: PhotoGridImage[] = []
  const seen = new Set<string>()

  for (const album of albums) {
    const photoCount = (album.rows ?? []).flatMap(r => r.cells).filter(c => c.type === 'image' && c.src).length
    const albumCover = normalizeImageSrc(album.coverSrc) || ''
    const albumMeta = {
      albumId: album.id,
      albumTitle: album.title,
      albumCover,
      albumDate: album.date,
      photoCount
    }

    const cover = normalizeImageSrc(album.coverSrc)
    if (cover && !seen.has(cover)) {
      seen.add(cover)
      pool.push({ src: cover, ...albumMeta })
    }
    for (const row of album.rows) {
      for (const cell of row.cells) {
        if (cell.type !== 'image') continue
        const src = normalizeImageSrc(cell.src)
        if (src && !seen.has(src)) {
          seen.add(src)
          pool.push({ src, ...albumMeta })
        }
      }
    }
  }

  // Partial Fisher-Yates: only shuffle as many slots as we need to sample.
  const take = Math.min(count, pool.length)
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i))
    ;[pool[i], pool[j]] = [pool[j]!, pool[i]!]
  }

  return { images: pool.slice(0, take) }
})
