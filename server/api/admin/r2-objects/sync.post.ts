// One step of re-checking the r2_objects index against the bucket. The admin
// storage & cost and R2 Images pages call this in a loop until `done`; each
// call returns within ~20 s and saves its progress, so a slow R2 page or a
// timeout only delays the walk. See server/utils/r2Objects.ts.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const result = await syncR2ObjectsStep()
  invalidateR2Inventory()
  return result
})
