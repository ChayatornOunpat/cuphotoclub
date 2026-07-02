export default defineEventHandler(async () => {
  const albums = await albumStore.list()
  return albums.filter(album => album.visibility === 'public')
})
