// R2 usage + cost estimate for the admin cost dashboard.
//
// Storage is the only meaningful cost driver for this project (egress is free
// on R2, and operations sit inside the free tier). We list every object once,
// aggregate bytes by top-level folder, and price it against R2 Standard rates.
// The full listing is cached per warm isolate for a few minutes so repeated
// dashboard loads don't re-walk the bucket.

// R2 Standard pricing (USD). Cloudflare bills storage per GB-month where
// 1 GB = 1e9 bytes (decimal). See developers.cloudflare.com/r2/pricing.
const PRICING = {
  storagePerGbMonth: 0.015,
  classAPerMillion: 4.5,
  classBPerMillion: 0.36,
  freeStorageGb: 10,
  freeClassAOps: 1_000_000,
  freeClassBOps: 10_000_000
}

const PROJECTION_TIERS_GB = [10, 25, 50, 100, 250]

interface FolderUsage { prefix: string, bytes: number, count: number }
interface LargestObject { key: string, bytes: number }
interface UsageSummary {
  totalBytes: number
  totalCount: number
  folders: FolderUsage[]
  largest: LargestObject[]
}

const CACHE_TTL_MS = 5 * 60 * 1000
let cache: { at: number, data: UsageSummary } | null = null

function topLevelPrefix(pathname: string): string {
  const slash = pathname.indexOf('/')
  return slash === -1 ? '(root)' : pathname.slice(0, slash)
}

async function computeUsage(): Promise<UsageSummary> {
  const folderMap = new Map<string, FolderUsage>()
  const largest: LargestObject[] = []
  let totalBytes = 0
  let totalCount = 0
  let cursor: string | undefined

  do {
    const result = await blob.list({ limit: 1000, cursor })
    for (const item of result.blobs) {
      const bytes = item.size ?? 0
      totalBytes += bytes
      totalCount += 1

      const prefix = topLevelPrefix(item.pathname)
      const folder = folderMap.get(prefix) ?? { prefix, bytes: 0, count: 0 }
      folder.bytes += bytes
      folder.count += 1
      folderMap.set(prefix, folder)

      // Keep a running top-10 largest without sorting the whole list.
      if (largest.length < 10) {
        largest.push({ key: item.pathname, bytes })
        if (largest.length === 10) largest.sort((a, b) => a.bytes - b.bytes)
      } else if (bytes > largest[0]!.bytes) {
        largest[0] = { key: item.pathname, bytes }
        largest.sort((a, b) => a.bytes - b.bytes)
      }
    }
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  return {
    totalBytes,
    totalCount,
    folders: [...folderMap.values()].sort((a, b) => b.bytes - a.bytes),
    largest: largest.sort((a, b) => b.bytes - a.bytes)
  }
}

async function getUsage(force: boolean): Promise<UsageSummary> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data
  const data = await computeUsage()
  cache = { at: Date.now(), data }
  return data
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const force = String(getQuery(event).refresh || '') === '1'
  const usage = await getUsage(force)

  const storageGb = usage.totalBytes / 1e9
  const billableGb = Math.max(0, storageGb - PRICING.freeStorageGb)
  const monthlyStorageCost = billableGb * PRICING.storagePerGbMonth

  const projections = PROJECTION_TIERS_GB.map(gb => ({
    gb,
    monthlyCost: Math.max(0, gb - PRICING.freeStorageGb) * PRICING.storagePerGbMonth
  }))

  return {
    generatedAt: (cache?.at ? new Date(cache.at) : new Date()).toISOString(),
    cached: !force && !!cache,
    totalBytes: usage.totalBytes,
    totalCount: usage.totalCount,
    storageGb,
    freeStorageGb: PRICING.freeStorageGb,
    freeStorageUsedPct: Math.min(100, (storageGb / PRICING.freeStorageGb) * 100),
    billableGb,
    monthlyStorageCost,
    folders: usage.folders,
    largest: usage.largest,
    projections,
    pricing: PRICING
  }
})
