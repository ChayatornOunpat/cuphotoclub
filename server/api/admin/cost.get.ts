// R2 usage + cost estimate for the admin cost dashboard.
//
// Storage is the only meaningful cost driver for this project (egress is free
// on R2, and operations sit inside the free tier). Usage comes from the
// r2_objects index (server/utils/r2Objects.ts) — one D1 query instead of
// walking the bucket, which took ~15 s at 16k objects. `?refresh=1` (the
// page's Refresh button) re-walks the bucket once to repair any drift.

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

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const force = String(getQuery(event).refresh || '') === '1'
  // An empty index means it has never been filled (first deploy), so fill it
  // now rather than report 0 bytes.
  if (force || (await countR2Objects()) === 0) await syncR2Objects()
  const usage = await r2StorageUsage()

  const storageGb = usage.totalBytes / 1e9
  const billableGb = Math.max(0, storageGb - PRICING.freeStorageGb)
  const monthlyStorageCost = billableGb * PRICING.storagePerGbMonth

  const projections = PROJECTION_TIERS_GB.map(gb => ({
    gb,
    monthlyCost: Math.max(0, gb - PRICING.freeStorageGb) * PRICING.storagePerGbMonth
  }))

  return {
    generatedAt: new Date().toISOString(),
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
