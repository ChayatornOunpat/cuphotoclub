<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin'] })

const { t } = useI18n()
useHead({ title: () => t('admin.historyImageTitle') })
</script>

<template>
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
</template>
