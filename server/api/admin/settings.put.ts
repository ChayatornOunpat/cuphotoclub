export default defineEventHandler(async (event) => {
  await requireManageUsers(event)
  const body = (await readBody(event)) as Record<string, unknown>

  for (const key of SETTING_KEYS) {
    if (key in body) {
      const value = String(body[key] ?? '')
      await db
        .insert(schema.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
    }
  }
  return getPublicSettings()
})
