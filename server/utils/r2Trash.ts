import { desc, inArray } from 'drizzle-orm'

// Soft-delete "trash can" for R2 images. Trashing an image keeps the underlying
// R2 object in place and only records metadata here; the admin inventory hides
// any key present in this table and the trash view lists them for restore or
// permanent purge. `db` and `schema` are auto-imported by @nuxthub/core.

export interface R2TrashEntry {
  key: string
  contentType: string | null
  size: number | null
  referenced: boolean
  references: Record<string, boolean> | null
  deletedBy: number | null
  deletedByEmail: string | null
  deletedByName: string | null
  deletedAt: string
}

export interface R2TrashInput {
  key: string
  contentType?: string | null
  size?: number | null
  referenced: boolean
  references?: Record<string, boolean> | null
  deletedBy?: number | null
  deletedByEmail?: string | null
  deletedByName?: string | null
}

// r2_trash has 9 columns; D1 caps a statement at 100 bound params, so we can
// insert at most floor(100 / 9) = 11 rows per statement (10 for headroom).
const TRASH_INSERT_BATCH = 10
// inArray() binds one param per value; stay well under the 100-param cap.
const TRASH_INARRAY_CHUNK = 90

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export async function listTrashedKeys(): Promise<string[]> {
  const rows = await db.select({ key: schema.r2Trash.key }).from(schema.r2Trash)
  return rows.map(row => row.key)
}

export async function trashedKeySet(): Promise<Set<string>> {
  return new Set(await listTrashedKeys())
}

export async function listR2Trash(): Promise<R2TrashEntry[]> {
  const rows = await db
    .select()
    .from(schema.r2Trash)
    .orderBy(desc(schema.r2Trash.deletedAt))

  return rows.map(row => ({
    key: row.key,
    contentType: row.contentType ?? null,
    size: row.size ?? null,
    referenced: row.referenced,
    references: (row.references as Record<string, boolean> | null) ?? null,
    deletedBy: row.deletedBy ?? null,
    deletedByEmail: row.deletedByEmail ?? null,
    deletedByName: row.deletedByName ?? null,
    deletedAt: row.deletedAt.toISOString()
  }))
}

// Records the given keys in the trash. Existing rows for the same key are
// replaced (delete-then-insert) so re-trashing refreshes the metadata without
// needing upsert-with-excluded gymnastics across a batched multi-row insert.
export async function addToR2Trash(entries: R2TrashInput[]) {
  const seen = new Set<string>()
  const rows = entries
    .map(entry => normalizeR2Key(entry.key) && { ...entry, key: normalizeR2Key(entry.key)! })
    .filter((entry): entry is R2TrashInput => !!entry)
    .filter((entry) => {
      if (seen.has(entry.key)) return false
      seen.add(entry.key)
      return true
    })
  if (!rows.length) return

  const now = new Date()
  const keys = rows.map(row => row.key)
  for (const c of chunk(keys, TRASH_INARRAY_CHUNK)) {
    await db.delete(schema.r2Trash).where(inArray(schema.r2Trash.key, c))
  }

  const values = rows.map(row => ({
    key: row.key,
    contentType: row.contentType ?? null,
    size: row.size ?? null,
    referenced: row.referenced,
    references: row.references ?? null,
    deletedBy: row.deletedBy ?? null,
    deletedByEmail: row.deletedByEmail ?? null,
    deletedByName: row.deletedByName ?? null,
    deletedAt: now
  }))
  for (const c of chunk(values, TRASH_INSERT_BATCH)) {
    await db.insert(schema.r2Trash).values(c)
  }
}

export async function removeFromR2Trash(keys: string[]) {
  const normalized = [...new Set(
    keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key)
  )]
  if (!normalized.length) return
  for (const c of chunk(normalized, TRASH_INARRAY_CHUNK)) {
    await db.delete(schema.r2Trash).where(inArray(schema.r2Trash.key, c))
  }
}
