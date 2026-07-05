import { eq } from 'drizzle-orm'

function normalizeR2Key(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const match = url.pathname.match(/\/images\/(.+)$/)
      return match?.[1] ? decodeURIComponent(match[1]) : null
    } catch {
      return null
    }
  }
  return trimmed.replace(/^\/images\//, '').replace(/^\/+/, '') || null
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{ key?: string; force?: boolean }>(event)
  const key = normalizeR2Key(body?.key)
  if (!key) throw createError({ statusCode: 400, message: 'Missing image key' })

  const [galleryPhoto] = await db.select({ id: schema.photos.id })
    .from(schema.photos).where(eq(schema.photos.r2Key, key)).limit(1)
  const [post] = await db.select({ id: schema.posts.id })
    .from(schema.posts).where(eq(schema.posts.coverR2Key, key)).limit(1)
  const [activity] = await db.select({ id: schema.events.id })
    .from(schema.events).where(eq(schema.events.coverR2Key, key)).limit(1)
  const [member] = await db.select({ id: schema.members.id })
    .from(schema.members).where(eq(schema.members.photoR2Key, key)).limit(1)
  const [heroRow] = await db.select({ value: schema.settings.value })
    .from(schema.settings).where(eq(schema.settings.key, 'heroImages')).limit(1)
  const heroValue = heroRow?.value
  const heroImages: string[] = Array.isArray(heroValue)
    ? heroValue
    : typeof heroValue === 'string'
      ? JSON.parse(heroValue || '[]')
      : []
  const usedAsHero = heroImages.some(item => normalizeR2Key(item) === key)

  const editorialAlbums = await albumStore.list()
  const usedInEditorialAlbum = editorialAlbums.some(album =>
    normalizeR2Key(album.coverSrc) === key
    || album.rows.flatMap(row => row.cells).some(cell => cell.type === 'image' && normalizeR2Key(cell.src) === key)
  )

  const inUse = Boolean(galleryPhoto || post || activity || member || usedAsHero || usedInEditorialAlbum)
  if (inUse && !body?.force) {
    throw createError({
      statusCode: 409,
      message: 'This image is still referenced elsewhere. Remove it from its usage first, or delete with force.'
    })
  }

  await blob.delete(key)
  return { ok: true }
})
