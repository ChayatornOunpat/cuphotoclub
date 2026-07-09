import { z } from 'zod'

const STYLES = ['essay', 'sticky', 'contact', 'darkroom', 'chapters']
const VISIBILITY = ['draft', 'link-only', 'public']
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function validISODate(value: unknown) {
  if (typeof value !== 'string' || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Structural check for the canvas rows JSON — this goes straight into the
// rows_json column and render code assumes the shape (rows[].cells[].type),
// so a malformed write here would crash reads later.
const cellSchema = z.object({
  type: z.enum(['image', 'text', 'pad']),
  span: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(6)]),
  src: z.string().optional(),
  caption: z.string().optional(),
  content: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  font: z.enum(['serif', 'sans']).optional()
})
const rowsSchema = z.array(z.object({ cells: z.array(cellSchema) }))

/** Returns an error message string, or null if the input is valid. */
export function validateAlbum(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.category ?? '').trim()) return 'Category is required'
  if (!validISODate(b.date)) return 'Date must use YYYY-MM-DD'
  if (b.dateEnd !== undefined && b.dateEnd !== '' && !validISODate(b.dateEnd)) return 'End date must use YYYY-MM-DD'
  if (typeof b.dateEnd === 'string' && b.dateEnd && typeof b.date === 'string' && b.dateEnd < b.date) return 'End date must be after start date'
  if (b.published !== undefined && b.published !== '' && !validISODate(b.published)) return 'Published date must use YYYY-MM-DD'
  if (b.visibility !== undefined && !VISIBILITY.includes(String(b.visibility))) return 'Invalid visibility'
  if (!String(b.excerpt ?? '').trim()) return 'Excerpt is required'
  if (!STYLES.includes(String(b.style))) return 'Invalid style'
  if (b.placement !== undefined && b.placement !== 'gallery') return 'Albums can only use gallery placement'
  if (b.rows !== undefined && !rowsSchema.safeParse(b.rows).success) return 'Invalid rows structure'
  return null
}
