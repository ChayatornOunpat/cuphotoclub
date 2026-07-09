<script setup lang="ts">
const { locale } = useI18n()
const config = useRuntimeConfig()
const siteUrl = (config.public.siteUrl || '').replace(/\/+$/, '')
const defaultOgImage = `${siteUrl}/club-icon.jpg`

useHead({
  titleTemplate: title => (title ? `${title} · CU Photo Club` : 'CU Photo Club'),
  htmlAttrs: {
    lang: () => locale.value
  },
  link: [
    { rel: 'icon', type: 'image/jpeg', href: '/club-icon.jpg' },
    { rel: 'apple-touch-icon', href: '/club-icon.jpg' }
  ],
  script: [
    {
      // Organization structured data — helps Google build a knowledge panel and
      // associate the brand, logo, and location. Rendered site-wide.
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'CU Photo Club',
        alternateName: 'ชมรมศิลปะการถ่ายภาพแห่งจุฬาลงกรณ์มหาวิทยาลัย',
        url: siteUrl || undefined,
        logo: defaultOgImage,
        foundingDate: '1967',
        telephone: '+66-63-725-5380',
        parentOrganization: {
          '@type': 'CollegeOrUniversity',
          name: 'Chulalongkorn University'
        },
        address: {
          '@type': 'PostalAddress',
          streetAddress: 'ชั้น 3 อาคารจุลจักรพงษ์ ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน',
          addressLocality: 'Bangkok',
          postalCode: '10330',
          addressCountry: 'TH'
        }
      })
    }
  ]
})

useSeoMeta({
  ogSiteName: 'CU Photo Club',
  ogType: 'website',
  ogImage: defaultOgImage,
  ogImageAlt: 'CU Photo Club',
  twitterCard: 'summary_large_image',
  twitterImage: defaultOgImage
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
