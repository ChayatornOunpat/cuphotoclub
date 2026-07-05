import type { AlbumInput } from '~~/shared/types'

type CreateAlbumBody = AlbumInput & {
  draftMediaPrefix?: string
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readBody<CreateAlbumBody>(event)
  const draftMediaPrefix = normalizeDraftMediaPrefix(body.draftMediaPrefix)
  delete body.draftMediaPrefix
  body.placement = 'gallery'

  const error = validateAlbum(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'draft'

  const album = await albumStore.create(body)

  if (!draftMediaPrefix) return album

  const migrated = await migrateDraftMediaToAlbum(draftMediaPrefix, album.id, body)
  if (!migrated.changed) return album

  return await albumStore.update(album.id, migrated.album) ?? album
})

function normalizeDraftMediaPrefix(value: string | undefined) {
  const prefix = String(value || '').replace(/[^a-z0-9/_-]/gi, '').replace(/\/+$/g, '')
  return prefix.startsWith('content-albums/drafts/') ? prefix : null
}

function rewriteDraftSrc(src: string | undefined, fromPrefix: string, toPrefix: string) {
  if (!src) return src
  const fromPath = `/images/${fromPrefix}/`
  const toPath = `/images/${toPrefix}/`
  if (src.startsWith(fromPath)) return `${toPath}${src.slice(fromPath.length)}`
  if (src.startsWith(`${fromPrefix}/`)) return `${toPrefix}/${src.slice(fromPrefix.length + 1)}`
  return src
}

async function migrateDraftMediaToAlbum(fromPrefix: string, albumId: string, album: AlbumInput) {
  const toPrefix = `content-albums/${albumId}`
  const { blobs } = await blob.list({ prefix: fromPrefix, limit: 1000 })
  const images = blobs.filter(item => item.contentType?.startsWith('image/'))
  let changed = false

  for (const item of images) {
    const file = await blob.get(item.pathname)
    if (!file) continue

    const suffix = item.pathname.slice(fromPrefix.length).replace(/^\/+/, '')
    if (!suffix) continue

    await blob.put(`${toPrefix}/${suffix}`, file, { contentType: item.contentType })
    await blob.delete(item.pathname).catch(() => {})
    changed = true
  }

  if (!changed) return { changed: false, album }

  const migratedAlbum: AlbumInput = {
    ...album,
    coverSrc: rewriteDraftSrc(album.coverSrc, fromPrefix, toPrefix) ?? '',
    rows: album.rows.map(row => ({
      ...row,
      cells: row.cells.map(cell => cell.type === 'image'
        ? { ...cell, src: rewriteDraftSrc(cell.src, fromPrefix, toPrefix) }
        : cell)
    }))
  }

  return { changed: true, album: migratedAlbum }
}
