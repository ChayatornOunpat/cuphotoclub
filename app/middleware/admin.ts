// Guards every /admin page (except login). Redirects to login when signed out.
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()
  const { ready, loggedIn, fetch } = useUserSession()
  // Session may not be hydrated yet on first navigation — wait before deciding.
  if (!ready.value) {
    await fetch()
  }
  if (!loggedIn.value) {
    return navigateTo(`${localePath('/admin/login')}?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
