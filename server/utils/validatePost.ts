/** Returns an error message string, or null if the input is valid. */
const VISIBILITY = ['draft', 'link-only', 'public']

export function validatePost(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (b.visibility !== undefined && !VISIBILITY.includes(String(b.visibility))) return 'Invalid visibility'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.tag ?? '').trim()) return 'Tag is required'
  if (!String(b.date ?? '').trim()) return 'Display date is required'
  if (!String(b.image ?? '').trim()) return 'Image URL is required'
  if (!String(b.excerpt ?? '').trim()) return 'Excerpt is required'
  if (!Array.isArray(b.blocks) || b.blocks.length === 0) return 'At least one content block is required'
  return null
}
