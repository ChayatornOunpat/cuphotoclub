// id/slug/title/category for album dropdowns. Separate from the paged list
// endpoint because a picker wants every album but almost none of the fields —
// this payload is a fraction of the full list and never touches `rows`.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return await albumStore.listPicker()
})
