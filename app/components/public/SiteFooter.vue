<script setup lang="ts">
const { data: settings } = useSiteSettings()

const socials = computed(() =>
  [
    { url: settings.value?.facebookUrl, icon: 'simple-icons:facebook', label: 'Facebook' },
    { url: settings.value?.instagramUrl, icon: 'simple-icons:instagram', label: 'Instagram' },
    { url: settings.value?.lineUrl, icon: 'simple-icons:line', label: 'LINE' }
  ].filter(s => s.url)
)
</script>

<template>
  <footer class="border-t border-line bg-paper-soft">
    <div class="mx-auto max-w-6xl px-4 py-12">
      <div class="flex flex-col gap-8 md:flex-row md:justify-between">
        <div class="max-w-sm">
          <p class="text-lg font-semibold text-ink">{{ strings.brand }}</p>
          <p class="mt-2 text-sm text-ink-soft">{{ settings?.footerText || strings.footerTagline }}</p>
          <div v-if="socials.length" class="mt-4 flex gap-3">
            <a
              v-for="s in socials"
              :key="s.label"
              :href="s.url || undefined"
              target="_blank"
              rel="noopener"
              :aria-label="s.label"
              class="text-ink-soft transition-colors hover:text-accent"
            >
              <Icon :name="s.icon" class="size-5" />
            </a>
          </div>
        </div>

        <nav class="grid grid-cols-2 gap-x-12 gap-y-2 text-sm sm:flex sm:gap-8">
          <NuxtLink v-for="link in navLinks.slice(1)" :key="link.to" :to="link.to" class="text-ink-soft hover:text-ink">
            {{ link.label }}
          </NuxtLink>
        </nav>
      </div>

      <div class="mt-10 border-t border-line pt-6 text-xs text-ink-soft">
        © {{ new Date().getFullYear() }} {{ strings.brand }}
      </div>
    </div>
  </footer>
</template>
