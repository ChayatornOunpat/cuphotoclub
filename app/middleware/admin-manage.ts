// owner/admin-only pages (users, settings). Editors are bounced to the dashboard.
export default defineNuxtRouteMiddleware(() => {
  const { user } = useUserSession()
  const role = user.value?.role
  if (role !== 'owner' && role !== 'admin') {
    return navigateTo('/admin')
  }
})
