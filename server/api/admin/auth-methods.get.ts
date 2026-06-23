// Public: lets the login page know whether "Sign in with Google" is configured.
export default defineEventHandler(() => {
  const cfg = useRuntimeConfig()
  return { google: Boolean(cfg.oauth?.google?.clientId) }
})
