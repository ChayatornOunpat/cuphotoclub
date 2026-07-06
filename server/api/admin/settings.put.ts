export default defineEventHandler(async (event) => {
  const actor = await requireManageUsers(event)
  const body = (await readBody(event)) as Record<string, unknown>
  const changed: string[] = []

  for (const key of SETTING_KEYS) {
    if (key in body) {
      const value = String(body[key] ?? '')
      await db
        .insert(schema.settings)
        .values({ key, value })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })
      changed.push(key)
    }
  }
  if (changed.length) {
    await recordAdminAudit(actor, {
      action: 'update',
      entityType: 'settings',
      entityId: 'public',
      entityTitle: 'Public settings',
      metadata: { changed }
    })
  }
  return getPublicSettings()
})
