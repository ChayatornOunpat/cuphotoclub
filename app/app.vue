<script setup lang="ts">
useHead({
  titleTemplate: title => (title ? `${title} · CU Photo Club` : 'CU Photo Club'),
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
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
