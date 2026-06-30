<script setup lang="ts">
const { locale } = useI18n()

useHead({
  titleTemplate: title => (title ? `${title} · CU Photo Club` : 'CU Photo Club'),
  htmlAttrs: {
    lang: () => locale.value
  },
  link: [{ rel: 'icon', href: '/favicon.ico' }]
})

useSeoMeta({
  ogSiteName: 'CU Photo Club',
  ogType: 'website',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <div>
    <NuxtLoadingIndicator color="#ec4899" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
