export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const items = await listR2Trash()
  return {
    total: items.length,
    totalSize: items.reduce((sum, item) => sum + (item.size ?? 0), 0),
    items
  }
})
