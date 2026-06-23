// Site settings (socials, footer, contact). Deduped across components via a fixed key.
export function useSiteSettings() {
  return useFetch('/api/settings', { key: 'site-settings' })
}
