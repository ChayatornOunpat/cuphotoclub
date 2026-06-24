// Client/SSR route guard for admin pages. Redirects to login when no session.
export default defineNuxtRouteMiddleware(async () => {
  const localePath = useLocalePath()
  const { ready, loggedIn, fetch } = useUserSession()
  if (!ready.value) {
    await fetch()
  }
  if (!loggedIn.value) {
    return navigateTo(localePath('/admin/login'))
  }
})
