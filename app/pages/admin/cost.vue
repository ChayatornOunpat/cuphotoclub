<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()

interface FolderUsage { prefix: string, bytes: number, count: number }
interface LargestObject { key: string, bytes: number }
interface Projection { gb: number, monthlyCost: number }
interface CostResponse {
  generatedAt: string
  cached: boolean
  totalBytes: number
  totalCount: number
  storageGb: number
  freeStorageGb: number
  freeStorageUsedPct: number
  billableGb: number
  monthlyStorageCost: number
  folders: FolderUsage[]
  largest: LargestObject[]
  projections: Projection[]
  pricing: {
    storagePerGbMonth: number
    classAPerMillion: number
    classBPerMillion: number
    freeStorageGb: number
    freeClassAOps: number
    freeClassBOps: number
  }
}

const forceLive = ref(false)
const { data, pending, error, refresh } = await useFetch<CostResponse>('/api/admin/cost', {
  query: { refresh: computed(() => (forceLive.value ? '1' : undefined)) },
  watch: false
})

const refreshing = ref(false)
async function doRefresh() {
  forceLive.value = true
  refreshing.value = true
  try {
    await refresh()
  } finally {
    refreshing.value = false
  }
}

useHead({ title: () => `${t('adminCost.title')} - Admin` })

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 MB'
  const mb = bytes / 1e6
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1e3))} KB`
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(bytes / 1e9).toFixed(2)} GB`
}
function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString('en-US')
}
function fmtUsd(n: number): string {
  if (!n) return '$0.00'
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}
function fmtPct(n: number): string {
  return `${n < 10 ? n.toFixed(1) : Math.round(n)}%`
}
function fmtOps(n: number): string {
  return n >= 1e6 ? `${n / 1e6}M` : fmtNum(n)
}
function shortKey(key: string): string {
  return key.length > 46 ? `…${key.slice(-44)}` : key
}

const folderShare = (bytes: number) => {
  const total = data.value?.totalBytes ?? 0
  return total ? (bytes / total) * 100 : 0
}

// The tier the current storage falls into: the smallest projection >= current
// usage (or the largest tier if usage already exceeds every listed tier).
const currentTierGb = computed(() => {
  const d = data.value
  if (!d?.projections.length) return null
  const match = d.projections.find(p => d.storageGb <= p.gb)
  return (match ?? d.projections.at(-1)!).gb
})
</script>

<template>
  <div class="admin-wrap">
    <div class="page-head">
      <div>
        <NuxtLink :to="localePath('/admin')" class="back">{{ t('adminCost.back') }}</NuxtLink>
        <h1>{{ t('adminCost.title') }}</h1>
        <p class="sub">{{ t('adminCost.lead') }}</p>
      </div>
      <div class="head-actions">
        <button type="button" class="refresh" :disabled="refreshing || pending" @click="doRefresh">
          {{ refreshing ? t('adminCost.refreshing') : t('adminCost.refresh') }}
        </button>
        <p v-if="data" class="stamp">
          {{ t('adminCost.updated', { time: formatDateTime(data.generatedAt) }) }}
          <span v-if="data.cached"> · {{ t('adminCost.cachedNote') }}</span>
        </p>
      </div>
    </div>

    <p v-if="error" class="empty">{{ t('adminCost.error') }}</p>
    <p v-else-if="pending && !data" class="empty">{{ t('adminCost.loading') }}</p>

    <template v-else-if="data">
      <!-- TOP STATS -->
      <section class="stats">
        <div class="stat stat--wide">
          <p class="stat__label">{{ t('adminCost.storageUsed') }}</p>
          <p class="stat__value">{{ fmtBytes(data.totalBytes) }}</p>
          <div class="meter" :aria-label="t('adminCost.freeTierMeter')">
            <div class="meter__fill" :style="{ width: `${Math.min(100, data.freeStorageUsedPct)}%` }" />
          </div>
          <p class="stat__foot">{{ fmtPct(data.freeStorageUsedPct) }} {{ t('adminCost.ofFreeTier', { gb: data.freeStorageGb }) }}</p>
        </div>
        <div class="stat">
          <p class="stat__label">{{ t('adminCost.objects') }}</p>
          <p class="stat__value">{{ fmtNum(data.totalCount) }}</p>
        </div>
        <div class="stat">
          <p class="stat__label">{{ t('adminCost.monthlyCost') }}</p>
          <p class="stat__value stat__value--cost">{{ fmtUsd(data.monthlyStorageCost) }}<small>{{ t('adminCost.perMonth') }}</small></p>
          <p v-if="data.monthlyStorageCost === 0" class="stat__foot stat__foot--ok">{{ t('adminCost.withinFreeTier') }}</p>
        </div>
      </section>

      <div class="cols">
        <!-- BREAKDOWN -->
        <section class="panel">
          <div class="panel__head">
            <h2>{{ t('adminCost.breakdownTitle') }}</h2>
            <p>{{ t('adminCost.breakdownLead') }}</p>
          </div>
          <table v-if="data.folders.length" class="tbl">
            <thead>
              <tr>
                <th>{{ t('adminCost.colFolder') }}</th>
                <th class="num">{{ t('adminCost.colSize') }}</th>
                <th class="num">{{ t('adminCost.colObjects') }}</th>
                <th class="share-col">{{ t('adminCost.colShare') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="folder in data.folders" :key="folder.prefix">
                <td><code>{{ folder.prefix }}</code></td>
                <td class="num">{{ fmtBytes(folder.bytes) }}</td>
                <td class="num muted">{{ fmtNum(folder.count) }}</td>
                <td class="share-col">
                  <div class="bar"><div class="bar__fill" :style="{ width: `${folderShare(folder.bytes)}%` }" /></div>
                  <span class="bar__pct">{{ fmtPct(folderShare(folder.bytes)) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p v-else class="empty">{{ t('adminCost.empty') }}</p>
        </section>

        <!-- LARGEST -->
        <section v-if="data.largest.length" class="panel">
          <div class="panel__head">
            <h2>{{ t('adminCost.largestTitle') }}</h2>
            <p>{{ t('adminCost.largestLead') }}</p>
          </div>
          <ul class="largest">
            <li v-for="obj in data.largest" :key="obj.key">
              <code :title="obj.key">{{ shortKey(obj.key) }}</code>
              <span>{{ fmtBytes(obj.bytes) }}</span>
            </li>
          </ul>
        </section>
      </div>

      <!-- PROJECTIONS -->
      <section class="panel">
        <div class="panel__head">
          <h2>{{ t('adminCost.projectionsTitle') }}</h2>
          <p>{{ t('adminCost.projectionsLead') }}</p>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>{{ t('adminCost.colLibrary') }}</th>
              <th class="num">{{ t('adminCost.colEstCost') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in data.projections" :key="p.gb" :class="{ 'is-current': p.gb === currentTierGb }">
              <td>{{ p.gb }} GB</td>
              <td class="num">{{ p.monthlyCost === 0 ? t('adminCost.freeTag') : fmtUsd(p.monthlyCost) }}</td>
              <td>
                <span v-if="p.gb === currentTierGb" class="tag tag--now">{{ t('adminCost.currentTag') }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- PRICING REFERENCE -->
      <section class="panel panel--muted">
        <div class="panel__head">
          <h2>{{ t('adminCost.pricingTitle') }}</h2>
        </div>
        <dl class="pricing">
          <div>
            <dt>{{ t('adminCost.pricingStorage') }}</dt>
            <dd>${{ data.pricing.storagePerGbMonth }} <small>{{ t('adminCost.unitGbMonth') }}</small></dd>
          </div>
          <div>
            <dt>{{ t('adminCost.pricingClassA') }}</dt>
            <dd>${{ data.pricing.classAPerMillion.toFixed(2) }} <small>{{ t('adminCost.unitMillion') }}</small></dd>
          </div>
          <div>
            <dt>{{ t('adminCost.pricingClassB') }}</dt>
            <dd>${{ data.pricing.classBPerMillion.toFixed(2) }} <small>{{ t('adminCost.unitMillion') }}</small></dd>
          </div>
          <div>
            <dt>{{ t('adminCost.pricingEgress') }}</dt>
            <dd class="free">{{ t('adminCost.pricingFree') }}</dd>
          </div>
        </dl>
        <p class="freetier">{{ t('adminCost.freeTierLine', { storage: data.pricing.freeStorageGb, classA: fmtOps(data.pricing.freeClassAOps), classB: fmtOps(data.pricing.freeClassBOps) }) }}</p>
        <p class="note">{{ t('adminCost.opsNote') }}</p>
        <NuxtLink :to="localePath('/admin/r2-images')" class="orphan-cta">{{ t('adminCost.orphanCta') }}</NuxtLink>
      </section>
    </template>
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; gap: 1.5rem; flex-wrap: wrap; }
.page-head h1 { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; margin-top: 0.5rem; }
.back { display: inline-block; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.sub { font-size: 0.78rem; line-height: 1.7; color: var(--muted); margin-top: 0.35rem; max-width: 60ch; }
.head-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem; }
.refresh { border: 1px solid var(--subtle); background: none; color: var(--dark); cursor: pointer; font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; padding: 0.55rem 1.1rem; transition: border-color 0.2s, color 0.2s; }
.refresh:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.refresh:disabled { opacity: 0.5; cursor: default; }
.stamp { color: var(--muted); font-size: 0.56rem; letter-spacing: 0.04em; text-align: right; }

.empty { color: var(--muted); font-size: 0.9rem; padding: 2rem 0; }

/* Top stats */
.stats { display: grid; grid-template-columns: 1.6fr 1fr 1fr; gap: 1px; background: var(--subtle); border: 1px solid var(--subtle); margin-bottom: 2rem; }
.stat { background: var(--body-bg); padding: 1.6rem 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; }
.stat__label { font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
.stat__value { font-family: var(--font-serif); font-size: 2.8rem; line-height: 0.9; font-weight: 200; }
.stat__value--cost small { font-family: var(--font-sans); font-size: 0.8rem; color: var(--muted); margin-left: 0.3rem; }
.stat__foot { font-size: 0.62rem; color: var(--muted); margin-top: auto; }
.stat__foot--ok { color: #17684f; }
.meter { height: 6px; background: var(--subtle); overflow: hidden; margin-top: 0.4rem; }
.meter__fill { height: 100%; background: var(--accent); transition: width 0.4s ease; }

/* Two-column panels */
.cols { display: grid; grid-template-columns: 1.35fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; align-items: start; }
.panel { border: 1px solid var(--subtle); padding: 1.5rem; margin-bottom: 1.5rem; }
.cols .panel { margin-bottom: 0; }
.panel--muted { background: var(--paper); }
.panel__head { margin-bottom: 1.1rem; }
.panel__head h2 { font-family: var(--font-serif); font-size: 1.4rem; font-weight: 300; }
.panel__head p { color: var(--muted); font-size: 0.72rem; line-height: 1.6; margin-top: 0.25rem; }

.tbl { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
.tbl th { text-align: left; font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 500; padding: 0.6rem 0.6rem; border-bottom: 1px solid var(--subtle); }
.tbl td { padding: 0.7rem 0.6rem; border-bottom: 1px solid var(--subtle); vertical-align: middle; }
.tbl tr:last-child td { border-bottom: 0; }
.tbl .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.tbl .muted { color: var(--muted); }
.tbl code { font-family: ui-monospace, monospace; font-size: 0.72rem; color: var(--dark); }
.tbl tr.is-current td { background: color-mix(in srgb, var(--accent) 7%, transparent); }

.share-col { width: 34%; }
.bar { display: inline-block; width: calc(100% - 2.8rem); height: 6px; background: var(--subtle); vertical-align: middle; overflow: hidden; }
.bar__fill { height: 100%; background: var(--dark); }
.bar__pct { display: inline-block; width: 2.6rem; text-align: right; color: var(--muted); font-size: 0.64rem; font-variant-numeric: tabular-nums; }

.largest { list-style: none; }
.largest li { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 0.55rem 0; border-bottom: 1px solid var(--subtle); }
.largest li:last-child { border-bottom: 0; }
.largest code { font-family: ui-monospace, monospace; font-size: 0.66rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.largest span { font-size: 0.74rem; font-variant-numeric: tabular-nums; white-space: nowrap; }

.tag { display: inline-block; padding: 0.2rem 0.45rem; font-size: 0.5rem; letter-spacing: 0.12em; text-transform: uppercase; }
.tag--now { background: var(--accent); color: #F5F4F0; }

/* Pricing reference */
.pricing { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1px; background: var(--subtle); border: 1px solid var(--subtle); }
.pricing > div { background: var(--paper); padding: 1rem 1.1rem; }
.pricing dt { font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem; }
.pricing dd { font-family: var(--font-serif); font-size: 1.35rem; font-weight: 300; }
.pricing dd small { font-family: var(--font-sans); font-size: 0.6rem; color: var(--muted); }
.pricing dd.free { color: #17684f; }
.freetier { margin-top: 1rem; font-size: 0.68rem; color: var(--muted); line-height: 1.6; }
.note { margin-top: 0.6rem; font-size: 0.68rem; color: var(--muted); line-height: 1.6; }
.orphan-cta { display: inline-block; margin-top: 1.1rem; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--dark); text-decoration: none; border-bottom: 1px solid var(--accent); padding-bottom: 0.2rem; }
.orphan-cta:hover { color: var(--accent); }

@media (max-width: 860px) {
  .stats { grid-template-columns: 1fr 1fr; }
  .stat--wide { grid-column: 1 / -1; }
  .cols { grid-template-columns: 1fr; }
}
@media (max-width: 720px) {
  .admin-wrap { padding: 2rem 1rem 4rem; }
  .page-head { align-items: flex-start; }
  .head-actions { align-items: flex-start; }
  .stamp { text-align: left; }
  .stats { grid-template-columns: 1fr; }
  .share-col { width: 30%; }
}
</style>
