export default defineEventHandler(async (event) => {
  await requireManageUsers(event)

  const rows = await db.select().from(schema.users).orderBy(schema.users.createdAt)

  // Never leak hashes/subs; expose booleans instead.
  return rows.map(({ passwordHash, googleSub, ...u }) => ({
    ...u,
    hasPassword: Boolean(passwordHash),
    googleLinked: Boolean(googleSub)
  }))
})
