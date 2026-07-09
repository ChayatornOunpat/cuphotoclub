import { desc, eq } from 'drizzle-orm'
import type { BlobObject } from '@nuxthub/core/blob'

interface ImageUsage {
  kind: 'gallery' | 'hero' | 'post-cover' | 'event-cover' | 'member-photo' | 'editorial-album'
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

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '') || undefined

  const [blobs, galleryPhotos, posts, events, members, heroRows, editorialAlbums] = await Promise.all([
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
      coverR2Key: schema.events.coverR2Key
    }).from(schema.events).orderBy(desc(schema.events.createdAt)),
    db.select({
      id: schema.members.id,
      nickname: schema.members.nickname,
      photoR2Key: schema.members.photoR2Key
    }).from(schema.members).orderBy(schema.members.sortOrder),
    db.select({ value: schema.settings.value }).from(schema.settings).where(eq(schema.settings.key, 'heroImages')),
    albumStore.list()
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
  }

  for (const member of members) {
    addUsage(otherUsage, member.photoR2Key, {
      kind: 'member-photo',
      label: member.nickname,
      href: '/admin/members',
      role: 'member photo'
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

  for (const album of editorialAlbums) {
    addUsage(otherUsage, album.coverSrc, {
      kind: 'editorial-album',
      label: album.title,
      href: `/admin/albums/${album.id}`,
      role: 'editorial cover'
    })
    for (const cell of album.rows.flatMap(row => row.cells)) {
      if (cell.type !== 'image') continue
      addUsage(otherUsage, cell.src, {
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

  const images: R2InventoryImage[] = blobs.map(item => {
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

  return {
    prefix: prefix ?? '',
    total: images.length,
    linkedToAlbums: images.filter(image => image.albums.length > 0).length,
    referenced: images.filter(image => image.albums.length > 0 || image.usages.length > 0).length,
    images
  }
})
