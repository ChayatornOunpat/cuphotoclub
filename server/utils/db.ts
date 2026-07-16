// Typed re-exports of NuxtHub's generated packages. The auto-imports that
// @nuxthub/core registers point TypeScript at the package *directories*, which
// have no main/types entry — so `db`/`schema`/`blob`/`kv` silently degrade to
// `any` under skipLibCheck. Re-exporting through the bare specifiers (resolved
// via each package's exports map) restores the real types; the runtime modules
// are the same files either way.
export { db, schema } from '@nuxthub/db'
export { blob, ensureBlob } from '@nuxthub/blob'
export { kv } from '@nuxthub/kv'
