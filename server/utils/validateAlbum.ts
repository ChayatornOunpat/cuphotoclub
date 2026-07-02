const STYLES = ['essay', 'sticky', 'contact']
const VISIBILITY = ['draft', 'link-only', 'public']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validISODate(value: unknown) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

/** Returns an error message string, or null if the input is valid. */
export function validateAlbum(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.category ?? '').trim()) return 'Category is required'
  if (!validISODate(b.date)) return 'Date must use YYYY-MM-DD'
  if (b.published !== undefined && b.published !== '' && !validISODate(b.published)) return 'Published date must use YYYY-MM-DD'
  if (b.visibility !== undefined && !VISIBILITY.includes(String(b.visibility))) return 'Invalid visibility'
  if (!String(b.excerpt ?? '').trim()) return 'Excerpt is required'
  if (!STYLES.includes(String(b.style))) return 'Invalid style'
  if (b.placement !== undefined && b.placement !== 'gallery') return 'Albums can only use gallery placement'
  return null
}
