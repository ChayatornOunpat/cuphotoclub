export default defineEventHandler(async (event) => {
  if (!(await rateLimit(`login:${clientIp(event)}`, 10, 10 * 60 * 1000))) {
    throw createError({ statusCode: 429, statusMessage: 'Too many login attempts, try again later' })
  }

  const { password } = await readBody<{ password?: string }>(event)
  const { adminPassword } = useRuntimeConfig()

  if (!adminPassword) {
    throw createError({ statusCode: 500, statusMessage: 'Admin password is not configured (set NUXT_ADMIN_PASSWORD)' })
  }
  if (!password || password !== adminPassword) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid password' })
  }

  await setUserSession(event, { user: { name: 'Admin' }, loggedInAt: new Date().toISOString() })
  return { ok: true }
})
