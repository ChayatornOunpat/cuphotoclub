<script setup lang="ts">
// One page for every fixed single-image slot on the public landing page.
// Each block below saves independently through its own API path.
definePageMeta({ layout: 'admin', middleware: ['admin'] })

const { t } = useI18n()
useHead({ title: () => t('admin.landingImagesTitle') })
</script>

<template>
  <div class="landing-images">
    <header class="landing-images__head">
      <h1 class="landing-images__title">{{ t('admin.landingImagesTitle') }}</h1>
      <p class="landing-images__lead">{{ t('admin.landingImagesLead') }}</p>
    </header>

    <AdminLandingSectionImageEditor
      api-path="/api/admin/history-image"
      prefix="history"
      section-number="03"
      :section-label="t('nav.history')"
      :title="t('admin.historyImageTitle')"
      :lead="t('admin.historyImageLead')"
      :picker-title="t('admin.historyImagePickerTitle')"
      :preview-alt="t('admin.historyImagePreviewAlt')"
      :empty-title="t('admin.historyImageEmpty')"
      :empty-hint="t('admin.historyImageEmptyHint')"
      tone="history"
    />

    <hr class="landing-images__rule">

    <AdminLandingSectionImageEditor
      api-path="/api/admin/clubroom-image"
      prefix="clubroom"
      section-number="04"
      :section-label="t('site.about.eyebrow')"
      :title="t('admin.clubroomImageTitle')"
      :lead="t('admin.clubroomImageLead')"
      :picker-title="t('admin.clubroomImagePickerTitle')"
      :preview-alt="t('admin.clubroomImagePreviewAlt')"
      :empty-title="t('admin.clubroomImageEmpty')"
      :empty-hint="t('admin.clubroomImageEmptyHint')"
      tone="clubroom"
    />
  </div>
</template>

<style scoped>
.landing-images {
  display: grid;
  gap: 3.5rem;
  max-width: 1040px;
  margin: 0 auto;
  padding: 2.5rem 2rem 5rem;
}

.landing-images__title {
  margin: 0 0 0.75rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(2.8rem, 6vw, 5.5rem);
  font-weight: 200;
  letter-spacing: -0.035em;
  line-height: 0.95;
}

.landing-images__lead {
  max-width: 560px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.75;
}

.landing-images__rule {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--subtle);
}

@media (max-width: 520px) {
  .landing-images { padding-inline: 1rem; }
}
</style>
