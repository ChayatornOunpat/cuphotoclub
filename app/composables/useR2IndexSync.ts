// Drives the stepped re-check of the r2_objects index against the R2 bucket
// (POST /api/admin/r2-objects/sync) until the server reports it done. Each
// step saves its progress server-side, so a failed or timed-out step is simply
// retried and carries on where the last one stopped. See
// server/utils/r2Objects.ts for why the walk is stepped at all.
const MAX_CONSECUTIVE_FAILURES = 5

export function useR2IndexSync() {
  const syncing = ref(false)
  const checked = ref(0)
  const failed = ref(false)

  // Resolves true once the whole bucket has been checked.
  async function run(): Promise<boolean> {
    if (syncing.value) return false
    syncing.value = true
    failed.value = false
    checked.value = 0
    let failures = 0
    try {
      while (true) {
        try {
          const step = await $fetch<{ done: boolean, checked: number }>('/api/admin/r2-objects/sync', { method: 'POST' })
          failures = 0
          checked.value = step.checked
          if (step.done) return true
        } catch {
          if (++failures >= MAX_CONSECUTIVE_FAILURES) {
            failed.value = true
            return false
          }
        }
      }
    } finally {
      syncing.value = false
    }
  }

  return { syncing, checked, failed, run }
}
