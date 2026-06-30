export default defineEventHandler(async () => {
  return albumStore.list()
})
