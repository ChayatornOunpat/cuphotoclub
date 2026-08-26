export default defineEventHandler(async () => {
  // The public archive renders cards, not full canvases — it only needs a cover
  // and a photo count per album. Both are stored as columns (resolved on write),
  // so this never reads the `rows` JSON: doing so pulled ~3MB out of D1 per
  // request and pushed the Worker to its resource limit (intermittent 1102).
  const { items } = await albumStore.listMeta({ visibility: ['public'] })
  return items
})
