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
  albumDateEnd?: string
  photoCount: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const count = Math.min(Math.max(Number(query.count) || 250, 1), 500)

  // Srcs only — the grid never renders an album's layout, so pulling every
  // album's full rows_json here is what used to stall this endpoint.
  const albums = await albumStore.listPhotoGrid()

  // Build enriched image entries with album association
  const pool: PhotoGridImage[] = []
  const seen = new Set<string>()

  for (const album of albums) {
    const albumCover = normalizeImageSrc(album.coverSrc) || ''
    const albumMeta = {
      albumId: album.id,
      albumTitle: album.title,
      albumCover,
      albumDate: album.date,
      albumDateEnd: album.dateEnd,
      photoCount: album.photoCount
    }

    if (albumCover && !seen.has(albumCover)) {
      seen.add(albumCover)
      pool.push({ src: albumCover, ...albumMeta })
    }
    for (const raw of album.srcs) {
      const src = normalizeImageSrc(raw)
      if (src && !seen.has(src)) {
        seen.add(src)
        pool.push({ src, ...albumMeta })
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
