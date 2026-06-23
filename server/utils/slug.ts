import { eq } from 'drizzle-orm'

// Keeps unicode letters/numbers (incl. Thai), turns the rest into hyphens.
export function slugify(input: string): string {
  return (input || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Returns a slug unique within the given table (appends -2, -3, … on collision).
// `table` is a Drizzle table exposing `id` and `slug` columns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function uniqueSlug(table: any, base: string, excludeId?: number): Promise<string> {
  const root = slugify(base) || `item-${Date.now().toString(36)}`
  let candidate = root
  let i = 2
  while (true) {
    const [row] = await db.select({ id: table.id }).from(table).where(eq(table.slug, candidate)).limit(1)
    if (!row || row.id === excludeId) return candidate
    candidate = `${root}-${i++}`
  }
}

export function uniqueAlbumSlug(base: string, excludeId?: number) {
  return uniqueSlug(schema.albums, base, excludeId)
}
