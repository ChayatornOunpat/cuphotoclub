export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await postStore.list()
})
