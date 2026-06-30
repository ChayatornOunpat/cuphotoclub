export default defineEventHandler(async () => {
  return await albumStore.list()
})
