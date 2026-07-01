// Dev-only: ensure an owner account exists so you can log into /admin immediately.
// Credentials come from ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD (see .env).
// `db` and `schema` are auto-imported by @nuxthub/core.
export default defineNitroPlugin(() => {
  if (!import.meta.dev) return
  if (realDataOnly()) return

  // Runs at startup; retry briefly in case NuxtHub's dev migrations haven't applied yet.
  void (async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const [existing] = await db
          .select({ id: schema.users.id })
          .from(schema.users)
          .limit(1)
        if (existing) return

        const email = process.env.ADMIN_SEED_EMAIL || 'admin@cuphotoclub.local'
        const password = process.env.ADMIN_SEED_PASSWORD || 'changeme123'
        const passwordHash = await hashPassword(password)

        await db.insert(schema.users).values({
          email,
          name: 'Owner',
          role: 'owner',
          passwordHash,
          active: true
        })
        console.log(`\n[seed] Created owner account → ${email} (password from ADMIN_SEED_PASSWORD)\n`)
        return
      } catch {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    console.warn('[seed] owner not seeded (db not ready) — will retry on next dev start')
  })()
})
