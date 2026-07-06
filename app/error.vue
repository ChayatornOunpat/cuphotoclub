<script setup lang="ts">
const props = defineProps<{
  error: {
    statusCode?: number
    statusMessage?: string
    message?: string
  }
}>()

const { t } = useI18n()
const route = useRoute()
const statusCode = computed(() => props.error?.statusCode ?? 500)
const detail = computed(() => props.error?.statusMessage || props.error?.message || '')
const is404 = computed(() => statusCode.value === 404)
const isChunkLoad = computed(() =>
  /dynamically imported module|loading chunk|importing a module script failed/i.test(detail.value)
)

const heading = computed(() => {
  if (is404.value) return t('errorPage.notFoundHeading')
  if (isChunkLoad.value) return t('errorPage.chunkHeading')
  return t('errorPage.genericHeading')
})

const lead = computed(() => {
  if (is404.value) return t('errorPage.notFoundLead')
  if (isChunkLoad.value) return t('errorPage.chunkLead')
  return t('errorPage.genericLead')
})

const technicalDetail = computed(() => {
  if (!detail.value) return ''
  if (detail.value === heading.value || detail.value === lead.value) return ''
  return detail.value
})

function retry() {
  if (import.meta.client) {
    window.location.reload()
    return
  }

  clearError({ redirect: route.fullPath || '/' })
}

function goHome() {
  clearError({ redirect: '/' })
}

useHead({
  title: () => `${statusCode.value} ${heading.value} · CU Photo Club`
})
</script>

<template>
  <main class="error-page">
    <section class="error-hero" aria-labelledby="error-title">
      <div class="error-hero__inner">
        <p class="error-kicker">CU PHOTOCLUB / ERROR {{ statusCode }}</p>
        <h1 id="error-title">{{ heading }}</h1>
        <p class="error-lead">{{ lead }}</p>

        <div class="error-actions" :aria-label="t('errorPage.recoveryActions')">
          <button type="button" class="error-btn error-btn--primary" @click="retry">
            {{ t('errorPage.retry') }}
          </button>
          <button type="button" class="error-btn error-btn--ghost" @click="goHome">
            {{ t('errorPage.goHome') }}
          </button>
        </div>
      </div>
    </section>

    <section class="error-detail" :aria-label="t('errorPage.errorDetail')">
      <div class="error-detail__inner">
        <p class="error-detail__label">{{ t('errorPage.status') }}</p>
        <p class="error-detail__code">{{ statusCode }}</p>
        <p class="error-detail__note">
          {{ t('errorPage.note') }}
        </p>

        <details v-if="technicalDetail" class="error-tech">
          <summary>{{ t('errorPage.technicalDetail') }}</summary>
          <p>{{ technicalDetail }}</p>
        </details>
      </div>
    </section>
  </main>
</template>

<style scoped>
.error-page {
  min-height: 100vh;
  background: var(--body-bg);
  color: var(--dark);
}

.error-hero {
  min-height: 68vh;
  display: flex;
  align-items: flex-end;
  background:
    linear-gradient(rgba(12, 12, 10, 0.62), rgba(12, 12, 10, 0.78)),
    radial-gradient(circle at 78% 12%, rgba(232, 24, 110, 0.18), transparent 34%),
    var(--hero-bg);
  color: #F5F4F0;
  border-bottom: 2px solid var(--accent);
}

.error-hero__inner,
.error-detail__inner {
  width: min(100%, 1380px);
  margin: 0 auto;
  padding-inline: clamp(1.5rem, 5vw, 4rem);
}

.error-hero__inner {
  padding-block: clamp(4rem, 9vw, 7rem);
}

.error-kicker {
  font-family: var(--font-latin-sans);
  font-size: 0.58rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: clamp(1.25rem, 3vw, 2rem);
}

.error-hero h1 {
  max-width: 980px;
  font-family: var(--font-serif);
  font-size: clamp(3.2rem, 10vw, 9rem);
  font-weight: 200;
  line-height: 0.94;
  letter-spacing: 0;
}

.error-lead {
  max-width: 660px;
  margin-top: clamp(1.25rem, 3vw, 2rem);
  color: rgba(245, 244, 240, 0.76);
  font-size: clamp(1rem, 1.5vw, 1.18rem);
  line-height: 1.85;
}

.error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: clamp(2rem, 4vw, 3rem);
}

.error-btn {
  min-height: 2.75rem;
  border: 1px solid rgba(245, 244, 240, 0.28);
  padding: 0.78rem 1.2rem;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}

.error-btn--primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #F5F4F0;
}

.error-btn--primary:hover {
  background: #F5F4F0;
  border-color: #F5F4F0;
  color: var(--dark);
}

.error-btn--ghost {
  background: transparent;
  color: #F5F4F0;
}

.error-btn--ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.error-detail {
  padding-block: clamp(2.5rem, 6vw, 4.5rem);
}

.error-detail__inner {
  display: grid;
  grid-template-columns: minmax(5rem, 9rem) minmax(0, 1fr);
  gap: 0.75rem clamp(1rem, 4vw, 3rem);
  align-items: start;
}

.error-detail__label {
  grid-column: 1;
  font-family: var(--font-latin-sans);
  font-size: 0.54rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

.error-detail__code {
  grid-column: 1;
  grid-row: 2 / span 2;
  font-family: var(--font-serif);
  font-size: clamp(2.75rem, 7vw, 5rem);
  font-weight: 200;
  line-height: 0.9;
  color: var(--accent);
}

.error-detail__note,
.error-tech {
  grid-column: 2;
  max-width: 720px;
}

.error-detail__note {
  color: var(--muted);
  line-height: 1.85;
}

.error-tech {
  border-top: 1px solid var(--subtle);
  margin-top: 1rem;
  padding-top: 1rem;
}

.error-tech summary {
  width: fit-content;
  color: var(--dark);
  cursor: pointer;
  font-size: 0.72rem;
}

.error-tech summary:hover {
  color: var(--accent);
}

.error-tech p {
  margin-top: 0.8rem;
  color: var(--muted);
  font-family: var(--font-latin-sans);
  font-size: 0.78rem;
  line-height: 1.7;
  overflow-wrap: anywhere;
}

@media (max-width: 760px) {
  .error-hero {
    min-height: 62vh;
  }

  .error-detail__inner {
    grid-template-columns: 1fr;
  }

  .error-detail__label,
  .error-detail__code,
  .error-detail__note,
  .error-tech {
    grid-column: 1;
  }

  .error-detail__code {
    grid-row: auto;
  }
}
</style>
