const STYLES = ['essay', 'sticky', 'contact']
const PLACEMENTS = ['blog', 'gallery', 'both']

/** Returns an error message string, or null if the input is valid. */
export function validateAlbum(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.category ?? '').trim()) return 'Category is required'
  if (!String(b.excerpt ?? '').trim()) return 'Excerpt is required'
  if (!STYLES.includes(String(b.style))) return 'Invalid style'
  if (!PLACEMENTS.includes(String(b.placement))) return 'Invalid placement'
  return null
}
