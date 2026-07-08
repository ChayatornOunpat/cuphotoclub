export default defineEventHandler(async () => {
  const albums = await albumStore.list()
  // The public archive renders cards, not full canvases — it only needs a cover
  // and a photo count per album. Returning every album's full `rows` JSON was
  // ~470KB and pushed the Worker to its resource limit (intermittent 1102).
  // Resolve those two things server-side and drop `rows` from the list payload.
  return albums
    .filter(album => album.visibility === 'public')
    .map(({ rows, ...album }) => {
      const cells = (rows ?? []).flatMap(row => row.cells)
      return {
        ...album,
        coverSrc: album.coverSrc || cells.find(cell => cell.type === 'image' && cell.src)?.src || '',
        photoCount: cells.filter(cell => cell.type === 'image' && cell.src).length
      }
    })
})
