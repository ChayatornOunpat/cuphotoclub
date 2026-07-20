import { z } from 'zod'

const VISIBILITY = ['draft', 'link-only', 'public']

// Structural check for the block editor JSON — stored verbatim in the body
// column, and render code switches on block.type assuming these shapes.
const blockSchema = z.union([
  z.object({
    id: z.string(),
    type: z.enum(['text', 'lead', 'heading', 'subheading', 'pullquote', 'inset']),
    content: z.string()
  }),
  z.object({ id: z.string(), type: z.literal('blockquote'), content: z.string(), cite: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal('image'), src: z.string(), caption: z.string().optional(), breakout: z.boolean().optional() }),
  z.object({ id: z.string(), type: z.literal('photo-full'), src: z.string(), caption: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal('photo-pair'), src1: z.string(), src2: z.string(), caption: z.string().optional() }),
  z.object({ id: z.string(), type: z.literal('divider') }),
  z.object({ id: z.string(), type: z.literal('qanda'), question: z.string(), answer: z.string() })
])
const blocksSchema = z.array(blockSchema).min(1)

/** Returns an error message string, or null if the input is valid. */
export function validatePost(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (b.visibility !== undefined && !VISIBILITY.includes(String(b.visibility))) return 'Invalid visibility'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.tag ?? '').trim()) return 'Tag is required'
  if (!String(b.date ?? '').trim()) return 'Display date is required'
  if (!String(b.image ?? '').trim()) return 'Image URL is required'
  if (!blocksSchema.safeParse(b.blocks).success) return 'Invalid content blocks'
  return null
}
