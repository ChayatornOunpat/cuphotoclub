import { eq, inArray } from 'drizzle-orm'

export interface R2DeleteReferenceInfo {
  galleryPhoto: boolean
  post: boolean
  activity: boolean
  member: boolean
  hero: boolean
  editorialAlbum: boolean
}

export function emptyR2DeleteReferenceInfo(): R2DeleteReferenceInfo {
  return {
    galleryPhoto: false,
    post: false,
    activity: false,
    member: false,
    hero: false,
    editorialAlbum: false
  }
}

export function isR2DeleteReferenced(info: R2DeleteReferenceInfo) {
  return info.galleryPhoto || info.post || info.activity || info.member || info.hero || info.editorialAlbum
}

export async function getR2DeleteReferences(keys: string[]) {
  const normalizedKeys = [...new Set(keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  const keySet = new Set(normalizedKeys)
  const references = new Map<string, R2DeleteReferenceInfo>()
  const ensure = (key: string) => {
    const existing = references.get(key)
    if (existing) return existing
    const created = emptyR2DeleteReferenceInfo()
    references.set(key, created)
    return created
  }

  if (!normalizedKeys.length) return references

  const [
    galleryPhotos,
    posts,
    activities,
    members,
    heroRows,
    editorialAlbums
  ] = await Promise.all([
    db.select({ r2Key: schema.photos.r2Key }).from(schema.photos).where(inArray(schema.photos.r2Key, normalizedKeys)),
    db.select({ coverR2Key: schema.posts.coverR2Key }).from(schema.posts).where(inArray(schema.posts.coverR2Key, normalizedKeys)),
    db.select({ coverR2Key: schema.events.coverR2Key }).from(schema.events).where(inArray(schema.events.coverR2Key, normalizedKeys)),
    db.select({ photoR2Key: schema.members.photoR2Key }).from(schema.members).where(inArray(schema.members.photoR2Key, normalizedKeys)),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'heroImages')),
    albumStore.list()
  ])

  for (const item of galleryPhotos) {
    const key = normalizeR2Key(item.r2Key)
    if (key) ensure(key).galleryPhoto = true
  }
  for (const item of posts) {
    const key = normalizeR2Key(item.coverR2Key)
    if (key) ensure(key).post = true
  }
  for (const item of activities) {
    const key = normalizeR2Key(item.coverR2Key)
    if (key) ensure(key).activity = true
  }
  for (const item of members) {
    const key = normalizeR2Key(item.photoR2Key)
    if (key) ensure(key).member = true
  }

  for (const item of decodeHeroImages(heroRows[0]?.value)) {
    const key = normalizeR2Key(item)
    if (key && keySet.has(key)) ensure(key).hero = true
  }

  for (const album of editorialAlbums) {
    const coverKey = normalizeR2Key(album.coverSrc)
    if (coverKey && keySet.has(coverKey)) ensure(coverKey).editorialAlbum = true
    for (const cell of album.rows.flatMap(row => row.cells)) {
      if (cell.type !== 'image') continue
      const key = normalizeR2Key(cell.src)
      if (key && keySet.has(key)) ensure(key).editorialAlbum = true
    }
  }

  return references
}

export async function scrubR2DeleteReferences(keys: string[]) {
  const normalizedKeys = [...new Set(keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  const keySet = new Set(normalizedKeys)
  if (!normalizedKeys.length) return

  const [galleryPhotos, heroRows, editorialAlbums] = await Promise.all([
    db.select({ id: schema.photos.id }).from(schema.photos).where(inArray(schema.photos.r2Key, normalizedKeys)),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'heroImages')),
    albumStore.list()
  ])

  const doomedIds = galleryPhotos.map(photo => photo.id)
  if (doomedIds.length) {
    await db.update(schema.albums)
      .set({ coverPhotoId: null })
      .where(inArray(schema.albums.coverPhotoId, doomedIds))
    await db.delete(schema.photos).where(inArray(schema.photos.id, doomedIds))
  }

  await Promise.all([
    db.update(schema.posts).set({ coverR2Key: null }).where(inArray(schema.posts.coverR2Key, normalizedKeys)),
    db.update(schema.events).set({ coverR2Key: null }).where(inArray(schema.events.coverR2Key, normalizedKeys)),
    db.update(schema.members).set({ photoR2Key: null }).where(inArray(schema.members.photoR2Key, normalizedKeys))
  ])

  const heroImages = decodeHeroImages(heroRows[0]?.value)
  if (heroImages.some(item => keySet.has(normalizeR2Key(item) || ''))) {
    await db.update(schema.settings)
      .set({ value: heroImages.filter(item => !keySet.has(normalizeR2Key(item) || '')), updatedAt: new Date() })
      .where(eq(schema.settings.key, 'heroImages'))
  }

  for (const album of editorialAlbums) {
    const coverHit = keySet.has(normalizeR2Key(album.coverSrc) || '')
    const cellHit = album.rows.some(row =>
      row.cells.some(cell => cell.type === 'image' && keySet.has(normalizeR2Key(cell.src) || '')))
    if (!coverHit && !cellHit) continue

    await albumStore.update(album.id, {
      ...album,
      coverSrc: coverHit ? '' : album.coverSrc,
      rows: album.rows.map(row => ({
        ...row,
        cells: row.cells.map(cell =>
          cell.type === 'image' && keySet.has(normalizeR2Key(cell.src) || '')
            ? { ...cell, src: '' }
            : cell)
      }))
    })
  }
}
