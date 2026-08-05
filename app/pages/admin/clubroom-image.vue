<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin'] })

const { t } = useI18n()
useHead({ title: () => t('admin.clubroomImageTitle') })
</script>

<template>
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
</template>
