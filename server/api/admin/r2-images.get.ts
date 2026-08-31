import { desc, eq, sql } from 'drizzle-orm'
import type { BlobObject } from '@nuxthub/core/blob'

interface ImageUsage {
  kind: 'gallery' | 'hero' | 'history' | 'clubroom' | 'post-cover' | 'event-cover' | 'event-gallery' | 'member-photo' | 'editorial-album' | 'contribution'
  label: string
  href?: string
  role?: string
}

interface R2InventoryImage {
  key: string
  contentType?: string
  size?: number
  uploadedAt?: string
  orderAt: number
  albums: ImageUsage[]
  usages: ImageUsage[]
}

interface R2InventoryResponse {
  prefix: string
  total: number
  linkedToAlbums: number
  referenced: number
  images: R2InventoryImage[]
}

function addUsage(map: Map<string, ImageUsage[]>, key: string | null | undefined, usage: ImageUsage) {
  if (!key) return
  const normalized = normalizeR2Key(key)
  if (!normalized) return
  const items = map.get(normalized) ?? []
  items.push(usage)
  map.set(normalized, items)
}

async function listImageBlobs(prefix?: string): Promise<BlobObject[]> {
  const blobs: BlobObject[] = []
  let cursor: string | undefined

  do {
    const result = await blob.list({ prefix, limit: 1000, cursor })
    blobs.push(...result.blobs.filter(item => item.contentType?.startsWith('image/')))
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  return blobs
}

interface EditorialAlbumRef {
  id: string
  title: string
  coverSrc: string
  srcs: string[]
}

// The inventory only needs each album's id, title, cover and the image srcs
// buried in its layout rows. albumStore.list() would pull and JSON.parse every
// album's full rows_json — the same multi-second cost that made /api/photogrid
// time out. Push the extraction into SQLite instead (json_each, the same
// technique migration 0022 uses for photo_count) and return bare srcs.
async function listEditorialAlbumRefs(): Promise<EditorialAlbumRef[]> {
  const rows = await db.all<{ id: string, title: string, cover_src: string, srcs: string | null }>(sql`
    SELECT a.id,
           a.title,
           a.cover_src,
           (
             SELECT group_concat(c.value ->> '$.src', char(10))
             FROM json_each(a.rows_json) AS r,
                  json_each(r.value -> '$.cells') AS c
             WHERE c.value ->> '$.type' = 'image'
               AND trim(coalesce(c.value ->> '$.src', '')) <> ''
           ) AS srcs
    FROM content_albums AS a
  `)
  return rows.map(row => ({
    id: row.id,
    title: row.title,
    coverSrc: row.cover_src ?? '',
    srcs: row.srcs ? row.srcs.split('\n') : []
  }))
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '') || undefined

  const cacheKey = prefix ?? ''
  const cached = getCachedR2Inventory<R2InventoryResponse>(cacheKey)
  if (cached) return cached

  const [blobs, galleryPhotos, posts, events, members, heroRows, historyRows, clubroomRows, editorialAlbums, submissions, trashedKeys] = await Promise.all([
    listImageBlobs(prefix),
    db
      .select({
        photoId: schema.photos.id,
        r2Key: schema.photos.r2Key,
        albumId: schema.albums.id,
        albumSlug: schema.albums.slug,
        albumTitle: schema.albums.title,
        coverPhotoId: schema.albums.coverPhotoId
      })
      .from(schema.photos)
      .leftJoin(schema.albums, eq(schema.photos.albumId, schema.albums.id)),
    db.select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      coverR2Key: schema.posts.coverR2Key
    }).from(schema.posts).orderBy(desc(schema.posts.createdAt)),
    db.select({
      id: schema.events.id,
      slug: schema.events.slug,
      title: schema.events.title,
      coverR2Key: schema.events.coverR2Key,
      galleryR2Keys: schema.events.galleryR2Keys
    }).from(schema.events).orderBy(desc(schema.events.createdAt)),
    db.select({
      id: schema.members.id,
      nickname: schema.members.nickname,
      photoR2Key: schema.members.photoR2Key
    }).from(schema.members).orderBy(schema.members.sortOrder),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'heroImages')),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'historyImage')),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'clubroomImage')),
    listEditorialAlbumRefs(),
    // Participant uploads are referenced by their submission row, never by an
    // album: approving COPIES the object to content-albums/<id>/<hash>.<ext>
    // (collectionSubmissions.albumKey), so an album only ever points at the
    // copy. Without this every original — including those of published photos —
    // reads as unreferenced, and this page offers bulk delete on that signal.
    db
      .select({
        r2Key: schema.collectionSubmissions.r2Key,
        review: schema.collectionSubmissions.review,
        linkId: schema.collectionSubmissions.linkId,
        linkLabel: schema.collectionLinks.label
      })
      .from(schema.collectionSubmissions)
      .innerJoin(
        schema.collectionLinks,
        eq(schema.collectionSubmissions.linkId, schema.collectionLinks.id)
      ),
    trashedKeySet()
  ])

  const albumUsage = new Map<string, ImageUsage[]>()
  const otherUsage = new Map<string, ImageUsage[]>()

  for (const row of galleryPhotos) {
    if (!row.albumId || !row.albumSlug || !row.albumTitle) continue
    addUsage(albumUsage, row.r2Key, {
      kind: 'gallery',
      label: row.albumTitle,
      href: `/admin/galleries/${row.albumId}`,
      role: row.photoId === row.coverPhotoId ? 'cover' : 'photo'
    })
  }

  for (const post of posts) {
    addUsage(otherUsage, post.coverR2Key, {
      kind: 'post-cover',
      label: post.title,
      href: `/admin/blog/${post.id}`,
      role: 'post cover'
    })
  }

  for (const item of events) {
    addUsage(otherUsage, item.coverR2Key, {
      kind: 'event-cover',
      label: item.title,
      href: `/admin/activities/${item.id}`,
      role: 'activity cover'
    })
    for (const key of item.galleryR2Keys) {
      addUsage(otherUsage, key, {
        kind: 'event-gallery',
        label: item.title,
        href: `/admin/activities/${item.id}`,
        role: 'activity gallery'
      })
    }
  }

  for (const member of members) {
    addUsage(otherUsage, member.photoR2Key, {
      kind: 'member-photo',
      label: member.nickname,
      href: '/admin/members',
      role: 'member photo'
    })
  }

  // Every state counts as referenced, not just 'approved': pending is still to
  // be looked at, and a rejected row is kept precisely so the call stays
  // reversible. Only a contributions/ blob with no row at all is an orphan.
  for (const row of submissions) {
    addUsage(otherUsage, row.r2Key, {
      kind: 'contribution',
      label: row.linkLabel || 'Untitled collection',
      href: `/admin/submissions/${row.linkId}`,
      role: `submission · ${row.review}`
    })
  }

  const heroImages = decodeHeroImages(heroRows[0]?.value)
  for (const key of heroImages) {
    addUsage(otherUsage, key, {
      kind: 'hero',
      label: 'Homepage hero',
      href: '/admin/hero-images',
      role: 'hero image'
    })
  }

  const historyImage = decodeManagedImage(historyRows[0]?.value)
  if (historyImage) {
    addUsage(otherUsage, historyImage, {
      kind: 'history',
      label: 'Our History',
      href: '/admin/history-image',
      role: 'history image'
    })
  }

  const clubroomImage = decodeManagedImage(clubroomRows[0]?.value)
  if (clubroomImage) {
    addUsage(otherUsage, clubroomImage, {
      kind: 'clubroom',
      label: 'Clubroom',
      href: '/admin/clubroom-image',
      role: 'clubroom image'
    })
  }

  for (const album of editorialAlbums) {
    addUsage(otherUsage, album.coverSrc, {
      kind: 'editorial-album',
      label: album.title,
      href: `/admin/albums/${album.id}`,
      role: 'editorial cover'
    })
    for (const src of album.srcs) {
      addUsage(otherUsage, src, {
        kind: 'editorial-album',
        label: album.title,
        href: `/admin/albums/${album.id}`,
        role: 'editorial image'
      })
    }
  }

  // Images upload into content-albums/<id>/ the moment they're dropped on the
  // canvas — before the album is saved. Recent uploads (within the grace
  // window) count as referenced by folder membership so they don't show as
  // "unreferenced" and get cleaned up while the author is still composing.
  // Older unplaced images (removed from the canvas) fall back to unreferenced.
  const editorialById = new Map(editorialAlbums.map(album => [album.id, album]))
  const folderCutoff = Date.now() - R2_ALBUM_FOLDER_GRACE_MS

  const images: R2InventoryImage[] = blobs
    .filter(item => !trashedKeys.has(item.pathname))
    .map(item => {
    const albums = albumUsage.get(item.pathname) ?? []
    const usages = otherUsage.get(item.pathname) ?? []
    const folderId = item.pathname.match(/^content-albums\/([^/]+)\//)?.[1]
    const folderAlbum = folderId ? editorialById.get(folderId) : undefined
    const uploadedRecently = (item.uploadedAt?.getTime() ?? 0) > folderCutoff
    if (folderAlbum && uploadedRecently && !usages.some(u => u.kind === 'editorial-album')) {
      usages.push({
        kind: 'editorial-album',
        label: folderAlbum.title || 'Album in progress',
        href: `/admin/albums/${folderAlbum.id}`,
        role: 'album folder'
      })
    }
    // Queue-order stamp written at upload time; uploadedAt (completion time)
    // is the fallback for images uploaded before the stamp existed.
    const seq = Number(item.customMetadata?.seq)
    return {
      key: item.pathname,
      contentType: item.contentType,
      size: item.size,
      uploadedAt: item.uploadedAt?.toISOString(),
      orderAt: Number.isFinite(seq) && seq > 0 ? seq : (item.uploadedAt?.getTime() ?? 0),
      albums,
      usages
    }
  })

  images.sort((a, b) => b.orderAt - a.orderAt || a.key.localeCompare(b.key))

  const response: R2InventoryResponse = {
    prefix: prefix ?? '',
    total: images.length,
    linkedToAlbums: images.filter(image => image.albums.length > 0).length,
    referenced: images.filter(image => image.albums.length > 0 || image.usages.length > 0).length,
    images
  }
  setCachedR2Inventory(cacheKey, response)
  return response
})
