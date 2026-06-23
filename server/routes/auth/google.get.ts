import { eq } from 'drizzle-orm'

// OAuth callback at /auth/google. Redirect URI to register in Google console:
//   {siteUrl}/auth/google
// Only emails already present + active in the users table are allowed in.
export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['email', 'profile']
  },
  async onSuccess(event, { user: googleUser }) {
    const email = String(googleUser.email || '').toLowerCase()
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1)

    if (!user || !user.active) {
      return sendRedirect(event, '/admin/login?error=not_allowed')
    }

    await db
      .update(schema.users)
      .set({
        lastLoginAt: new Date(),
        googleSub: String(googleUser.sub || ''),
        avatarUrl: user.avatarUrl || (googleUser.picture as string) || null,
        name: user.name || (googleUser.name as string) || null
      })
      .where(eq(schema.users.id, user.id))

    await setUserSession(event, {
      user: {
        id: user.id,
        email: user.email,
        name: user.name || (googleUser.name as string),
        role: user.role,
        avatarUrl: user.avatarUrl || (googleUser.picture as string)
      }
    })

    return sendRedirect(event, '/admin')
  },
  onError(event, error) {
    console.error('[oauth:google]', error.message)
    return sendRedirect(event, '/admin/login?error=oauth')
  }
})
