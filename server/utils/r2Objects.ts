import { sql } from 'drizzle-orm'
import type { BlobObject } from '@nuxthub/core/blob'

// ============================================================================
//  r2_objects — THE index of what is in the R2 bucket. Read this first.
// ============================================================================
//
// Why it exists
//   Listing the bucket is slow: 1,000 keys per call, one call after another.
//   At ~16k objects that is ~17 round trips and ~15 s, and it grows with every
//   photo. The storage & cost page used to do that on every load. Instead we
//   keep one row per object in D1 and answer "how much, where" with one query.
//
// The rule
//   Every code path that CREATES, COPIES or DELETES an R2 object must also
//   update this table, using the helpers below:
//
//     putR2Object(key, data, opts)     instead of blob.put(...)
//     deleteR2Object(key)              instead of blob.delete(...)
//     copyR2Object(src, dest)          (server/utils/r2Presign.ts) records the
//                                      copy itself — nothing extra to do
//     recordR2Objects([blob])          after the browser uploads straight to R2
//                                      and the server has confirmed the object
//                                      (the upload "complete" routes)
//     forgetR2Objects(keys)            after the browser deletes straight from
//                                      R2 via presigned URLs (delete sessions)
//
//   Calling blob.put / blob.delete directly is a bug: the object works fine
//   but the storage numbers silently drift from what Cloudflare bills.
//
// Reading it
//   r2StorageUsage() gives totals, per-folder totals and the largest objects.
//   listIndexedR2Images(prefix) lists images for the admin R2 inventory.
//   Prefer querying schema.r2Objects over blob.list() for anything that needs
//   "all objects" — blob.list() is only for checking a single key or prefix.
//
// Drift and the safety net
//   Some objects can still land outside these helpers: an upload whose browser
//   tab closed before "complete", a file added with wrangler or the Cloudflare
//   dashboard. syncR2ObjectsStep() re-walks the bucket in resumable steps and
//   repairs the table (see the section further down for why it is stepped).
//   The storage & cost and R2 Images pages drive it when an admin presses
//   Refresh, and automatically until the first walk has ever completed.
//   Never run it on an ordinary page load.
//
// Trash
//   Trashed objects (r2_trash) still sit in R2 and still cost money, so they
//   stay in this table. Only a permanent delete removes the row.
// ============================================================================

// A json_each() payload is one bound parameter, so batch size is bounded by
// D1's 100 KB statement limit rather than its 100-parameter cap. Rows run
// ~250 bytes of JSON (long content-albums keys), so 200 rows stays near 50 KB.
const JSON_BATCH = 200

export interface R2ObjectInput {
  key: string
  size: number
  contentType?: string | null
  uploadedAt?: Date
  orderAt?: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function r2TopLevelFolder(key: string): string {
  const slash = key.indexOf('/')
  return slash === -1 ? '(root)' : key.slice(0, slash)
}

// Queue-order stamp written at upload time; uploadedAt is the fallback for
// objects uploaded before the stamp existed.
function orderAtOf(item: BlobObject): number {
  const seq = Number(item.customMetadata?.seq)
  return Number.isFinite(seq) && seq > 0 ? seq : (item.uploadedAt?.getTime() ?? 0)
}

export function r2ObjectFromBlob(item: BlobObject): R2ObjectInput {
  return {
    key: item.pathname,
    size: item.size ?? 0,
    contentType: item.contentType ?? null,
    uploadedAt: item.uploadedAt,
    orderAt: orderAtOf(item)
  }
}

// Insert or update rows for objects that now exist in R2.
export async function recordR2Objects(items: (R2ObjectInput | BlobObject)[]) {
  const now = Date.now()
  const rows = items.map((item) => {
    const input = 'pathname' in item ? r2ObjectFromBlob(item) : item
    const key = normalizeR2Key(input.key)
    if (!key) return null
    const uploadedAt = input.uploadedAt?.getTime() ?? now
    return {
      k: key,
      f: r2TopLevelFolder(key),
      s: input.size ?? 0,
      t: input.contentType ?? null,
      u: uploadedAt,
      o: input.orderAt || uploadedAt
    }
  }).filter(row => !!row)

  for (const batch of chunk(rows, JSON_BATCH)) {
    // `WHERE true` is required: SQLite can't otherwise tell the upsert's ON
    // CONFLICT apart from a join clause after INSERT … SELECT.
    await db.run(sql`
      INSERT INTO r2_objects (object_key, folder, size, content_type, uploaded_at, order_at)
      SELECT j.value ->> '$.k', j.value ->> '$.f', j.value ->> '$.s',
             j.value ->> '$.t', j.value ->> '$.u', j.value ->> '$.o'
      FROM json_each(${JSON.stringify(batch)}) AS j
      WHERE true
      ON CONFLICT (object_key) DO UPDATE SET
        folder = excluded.folder,
        size = excluded.size,
        content_type = excluded.content_type,
        uploaded_at = excluded.uploaded_at,
        order_at = excluded.order_at
    `)
  }
}

// Remove rows for objects that no longer exist in R2.
export async function forgetR2Objects(keys: string[]) {
  const normalized = [...new Set(keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  for (const batch of chunk(normalized, JSON_BATCH)) {
    await db.run(sql`
      DELETE FROM r2_objects
      WHERE object_key IN (SELECT value FROM json_each(${JSON.stringify(batch)}))
    `)
  }
}

// blob.put + record. Use this for every server-side upload.
export async function putR2Object(...args: Parameters<typeof blob.put>): Promise<BlobObject> {
  const created = await blob.put(...args)
  await recordR2Objects([created])
  return created
}

// blob.delete + forget. Throws like blob.delete, so callers that want
// best-effort cleanup keep their own `.catch(() => {})`. The row is only
// removed once the delete succeeded.
export async function deleteR2Object(key: string) {
  await blob.delete(key)
  await forgetR2Objects([key])
}

// Record a server-side copy. The bytes are identical, so size and type come
// from the source row; only if the source was never indexed do we ask R2.
// order_at carries over too: R2's copy keeps the source's `seq` metadata.
export async function recordR2Copy(sourceKey: string, destKey: string) {
  const source = normalizeR2Key(sourceKey)
  const dest = normalizeR2Key(destKey)
  if (!source || !dest) return
  const now = Date.now()
  // RETURNING rather than the run() result's change count: that field's shape
  // differs between D1 (meta.changes) and the libsql types db is declared with.
  const copied = await db.all<{ object_key: string }>(sql`
    INSERT INTO r2_objects (object_key, folder, size, content_type, uploaded_at, order_at)
    SELECT ${dest}, ${r2TopLevelFolder(dest)}, size, content_type, ${now}, order_at
    FROM r2_objects WHERE object_key = ${source}
    ON CONFLICT (object_key) DO UPDATE SET
      folder = excluded.folder,
      size = excluded.size,
      content_type = excluded.content_type,
      uploaded_at = excluded.uploaded_at,
      order_at = excluded.order_at
    RETURNING object_key
  `)
  if (copied.length) return
  const head = await blob.head(dest).catch(() => null)
  if (head) await recordR2Objects([head])
}

// ─── Re-checking the table against the bucket ───────────────────────────────
//
// Walking the whole bucket is slow AND unpredictable: R2 returns ~280 objects
// per list call once metadata is included (~60 calls for 16k objects), and
// some key ranges intermittently take 15–90 s per call. A single request that
// walks everything therefore cannot be relied on to finish inside Cloudflare's
// 100 s limit — the first version of this did exactly that, timed out on
// every attempt, saved nothing, and so retried forever.
//
// So the walk runs in STEPS. Each call to syncR2ObjectsStep() continues from
// where the last one stopped, reconciles every page the moment it arrives,
// saves its position after every page, and returns after ~20 s. The admin
// pages call it in a loop (POST /api/admin/r2-objects/sync) until it reports
// done. A timeout or a slow page only delays the walk; it never loses it.
//
// R2 lists keys in byte order, which is also SQLite's BINARY text order, so
// each page covers a known key range: (previous page's last key, this page's
// last key]. Rows in that range that the page didn't return are gone from R2.

const SYNC_SETTING_KEY = 'r2ObjectsSync'
const SYNC_STEP_BUDGET_MS = 20_000
// Consecutive failed steps before the saved cursor is thrown away and the walk
// starts over (an expired or invalid cursor would otherwise fail forever).
const SYNC_MAX_FAILURES = 3

interface R2SyncRun {
  cursor?: string
  afterKey: string
  startedAt: number
  checked: number
  failures: number
}
interface R2SyncState {
  run: R2SyncRun | null
  // Set once a walk has completed. Until then the table may be partial, so
  // the pages show "counting…" instead of numbers.
  completedAt: number | null
}

async function readSyncState(): Promise<R2SyncState> {
  const [row] = await db
    .select({ value: schema.settings.value })
    .from(schema.settings)
    .where(sql`${schema.settings.key} = ${SYNC_SETTING_KEY}`)
  const value = row?.value as Partial<R2SyncState> | null | undefined
  return { run: value?.run ?? null, completedAt: value?.completedAt ?? null }
}

async function writeSyncState(state: R2SyncState) {
  await db
    .insert(schema.settings)
    .values({ key: SYNC_SETTING_KEY, value: state, updatedAt: new Date() })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: state, updatedAt: new Date() } })
}

// True once the table has been fully checked against the bucket at least once.
export async function r2IndexReady(): Promise<boolean> {
  return (await readSyncState()).completedAt !== null
}

// Make the table match one listed page. `afterKey` (exclusive) and `lastKey`
// (inclusive, omitted on the final page) bound the key range the page covers.
async function reconcilePage(blobs: BlobObject[], afterKey: string, lastKey: string | undefined, startedAt: number) {
  const range = lastKey
    ? sql`${schema.r2Objects.key} > ${afterKey} AND ${schema.r2Objects.key} <= ${lastKey}`
    : sql`${schema.r2Objects.key} > ${afterKey}`
  const existing = await db
    .select({
      key: schema.r2Objects.key,
      size: schema.r2Objects.size,
      orderAt: schema.r2Objects.orderAt,
      uploadedAt: schema.r2Objects.uploadedAt
    })
    .from(schema.r2Objects)
    .where(range)
  const existingByKey = new Map(existing.map(row => [row.key, row]))

  // Writes only what differs, to keep D1 row writes low on repeat runs.
  const changed = blobs.filter((item) => {
    const row = existingByKey.get(item.pathname)
    return !row || row.size !== (item.size ?? 0) || row.orderAt !== orderAtOf(item)
  })
  // Only rows older than the walk: anything recorded since it started may be
  // an upload that landed after this range was listed.
  const listedKeys = new Set(blobs.map(item => item.pathname))
  const stale = existing
    .filter(row => !listedKeys.has(row.key) && row.uploadedAt.getTime() < startedAt)
    .map(row => row.key)

  await recordR2Objects(changed)
  await forgetR2Objects(stale)
}

// Run one step of the walk (see above). Never call it from a normal page
// load; the admin pages drive it through POST /api/admin/r2-objects/sync.
export async function syncR2ObjectsStep(): Promise<{ done: boolean, checked: number }> {
  const state = await readSyncState()
  const run: R2SyncRun = state.run ?? { afterKey: '', startedAt: Date.now(), checked: 0, failures: 0 }
  const deadline = Date.now() + SYNC_STEP_BUDGET_MS

  while (true) {
    let page: Awaited<ReturnType<typeof blob.list>>
    try {
      page = await blob.list({ limit: 1000, cursor: run.cursor })
    } catch (error) {
      run.failures += 1
      await writeSyncState({ ...state, run: run.failures >= SYNC_MAX_FAILURES ? null : run })
      throw error
    }

    const lastKey = page.hasMore ? page.blobs.at(-1)?.pathname : undefined
    if (page.blobs.length || !page.hasMore) {
      await reconcilePage(page.blobs, run.afterKey, lastKey, run.startedAt)
    }
    run.checked += page.blobs.length
    run.failures = 0

    if (!page.hasMore) {
      await writeSyncState({ run: null, completedAt: Date.now() })
      return { done: true, checked: run.checked }
    }

    run.cursor = page.cursor
    if (lastKey) run.afterKey = lastKey
    await writeSyncState({ ...state, run })
    if (Date.now() > deadline) return { done: false, checked: run.checked }
  }
}

// Exclusive upper bound of a prefix range: the prefix with its last character
// bumped one code point. `key >= prefix AND key < bound` lets SQLite use a
// BINARY-collated index as a range scan — LIKE 'p%' cannot, because the
// default LIKE is case-insensitive.
export function prefixUpperBound(prefix: string): string {
  return prefix.slice(0, -1) + String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1)
}

// Every indexed image under `prefix` (all images when omitted), newest first
// in upload-queue order. What the admin R2 inventory lists instead of walking
// the bucket.
export async function listIndexedR2Images(prefix?: string) {
  const conditions = [sql`${schema.r2Objects.contentType} LIKE 'image/%'`]
  if (prefix) {
    conditions.push(
      sql`${schema.r2Objects.key} >= ${prefix}`,
      sql`${schema.r2Objects.key} < ${prefixUpperBound(prefix)}`
    )
  }
  return db
    .select()
    .from(schema.r2Objects)
    .where(sql.join(conditions, sql` AND `))
    .orderBy(sql`${schema.r2Objects.orderAt} desc`, schema.r2Objects.key)
}

export interface R2FolderUsage { prefix: string, bytes: number, count: number }
export interface R2LargestObject { key: string, bytes: number }

export async function r2StorageUsage() {
  const [totals, folders, largest] = await Promise.all([
    db.select({
      bytes: sql<number>`coalesce(sum(${schema.r2Objects.size}), 0)`,
      count: sql<number>`count(*)`
    }).from(schema.r2Objects),
    db.select({
      prefix: schema.r2Objects.folder,
      bytes: sql<number>`sum(${schema.r2Objects.size})`,
      count: sql<number>`count(*)`
    }).from(schema.r2Objects)
      .groupBy(schema.r2Objects.folder)
      .orderBy(sql`sum(${schema.r2Objects.size}) desc`),
    db.select({ key: schema.r2Objects.key, bytes: schema.r2Objects.size })
      .from(schema.r2Objects)
      .orderBy(sql`${schema.r2Objects.size} desc`)
      .limit(10)
  ])

  return {
    totalBytes: Number(totals[0]?.bytes ?? 0),
    totalCount: Number(totals[0]?.count ?? 0),
    folders: folders.map(row => ({ prefix: row.prefix, bytes: Number(row.bytes), count: Number(row.count) })) as R2FolderUsage[],
    largest: largest as R2LargestObject[]
  }
}
