import { eq, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

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
  const heroImages = decodeHeroImages(heroRow?.value)
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

  // Force-deleting an in-use image: scrub every reference so nothing points at a
  // blob that no longer exists (broken covers, hero slots, gallery tiles).
  if (inUse && body?.force) {
    if (galleryPhoto) {
      const doomed = await db.select({ id: schema.photos.id })
        .from(schema.photos).where(eq(schema.photos.r2Key, key))
      const doomedIds = doomed.map(p => p.id)
      if (doomedIds.length) {
        await db.update(schema.albums)
          .set({ coverPhotoId: null })
          .where(inArray(schema.albums.coverPhotoId, doomedIds))
        await db.delete(schema.photos).where(inArray(schema.photos.id, doomedIds))
      }
    }
    if (post) {
      await db.update(schema.posts).set({ coverR2Key: null }).where(eq(schema.posts.coverR2Key, key))
    }
    if (activity) {
      await db.update(schema.events).set({ coverR2Key: null }).where(eq(schema.events.coverR2Key, key))
    }
    if (member) {
      await db.update(schema.members).set({ photoR2Key: null }).where(eq(schema.members.photoR2Key, key))
    }
    if (usedAsHero) {
      const remaining = heroImages.filter(item => normalizeR2Key(item) !== key)
      await db.update(schema.settings)
        .set({ value: remaining, updatedAt: new Date() })
        .where(eq(schema.settings.key, 'heroImages'))
    }
    if (usedInEditorialAlbum) {
      for (const album of editorialAlbums) {
        const coverHit = normalizeR2Key(album.coverSrc) === key
        const cellHit = album.rows.some(row =>
          row.cells.some(cell => cell.type === 'image' && normalizeR2Key(cell.src) === key))
        if (!coverHit && !cellHit) continue
        await albumStore.update(album.id, {
          ...album,
          coverSrc: coverHit ? '' : album.coverSrc,
          rows: album.rows.map(row => ({
            ...row,
            cells: row.cells.map(cell =>
              cell.type === 'image' && normalizeR2Key(cell.src) === key
                ? { ...cell, src: '' }
                : cell)
          }))
        })
      }
    }
  }

  await blob.delete(key)
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'media',
    entityId: key,
    entityTitle: key.split('/').at(-1) ?? key,
    metadata: {
      forced: !!body?.force,
      inUse
    }
  })
  return { ok: true }
})
