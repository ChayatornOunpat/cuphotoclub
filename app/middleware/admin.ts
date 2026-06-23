// Guards every /admin page (except login). Redirects to login when signed out.
export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo(`/admin/login?redirect=${encodeURIComponent(to.fullPath)}`)
  }
})
