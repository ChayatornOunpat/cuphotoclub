export default defineEventHandler(async () => {
  return await postStore.list()
})
