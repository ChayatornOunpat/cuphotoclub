export default defineEventHandler(async (event) => {
  await requireManageUsers(event)
  return getPublicSettings()
})
