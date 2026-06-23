<script setup lang="ts">
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'

const route = useRoute()
const mobileOpen = ref(false)
watch(() => route.path, () => { mobileOpen.value = false })

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-line bg-paper/80 backdrop-blur">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
      <NuxtLink to="/" class="text-lg font-semibold tracking-tight text-ink">{{ strings.brand }}</NuxtLink>

      <nav class="hidden items-center gap-7 md:flex">
        <NuxtLink
          v-for="link in navLinks"
          :key="link.to"
          :to="link.to"
          class="text-sm transition-colors"
          :class="isActive(link.to) ? 'font-medium text-accent' : 'text-ink-soft hover:text-ink'"
        >
          {{ link.label }}
        </NuxtLink>
      </nav>

      <div class="flex items-center gap-1">
        <NuxtLink to="/search" class="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink" aria-label="ค้นหา">
          <Icon name="heroicons:magnifying-glass" class="size-5" />
        </NuxtLink>
        <button class="rounded-md p-2 text-ink-soft hover:bg-paper-soft hover:text-ink md:hidden" type="button" aria-label="เมนู" @click="mobileOpen = true">
          <Icon name="heroicons:bars-3" class="size-6" />
        </button>
      </div>
    </div>

    <!-- Mobile drawer -->
    <TransitionRoot :show="mobileOpen" as="template">
      <Dialog class="relative z-50 md:hidden" @close="mobileOpen = false">
        <TransitionChild as="template" enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100" leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0">
          <div class="fixed inset-0 bg-ink/40" />
        </TransitionChild>
        <div class="fixed inset-0 flex justify-end">
          <TransitionChild as="template" enter="duration-200 ease-in-out" enter-from="translate-x-full" enter-to="translate-x-0" leave="duration-150 ease-in-out" leave-from="translate-x-0" leave-to="translate-x-full">
            <DialogPanel class="flex w-72 max-w-[80%] flex-col bg-paper p-6">
              <div class="flex items-center justify-between">
                <span class="text-lg font-semibold text-ink">{{ strings.brand }}</span>
                <button type="button" class="rounded-md p-1 text-ink-soft hover:text-ink" aria-label="ปิด" @click="mobileOpen = false">
                  <Icon name="heroicons:x-mark" class="size-6" />
                </button>
              </div>
              <nav class="mt-6 flex flex-col gap-1">
                <NuxtLink
                  v-for="link in navLinks"
                  :key="link.to"
                  :to="link.to"
                  class="rounded-md px-3 py-2 text-sm font-medium"
                  :class="isActive(link.to) ? 'bg-accent-soft text-pink-700' : 'text-ink-soft hover:bg-paper-soft hover:text-ink'"
                >
                  {{ link.label }}
                </NuxtLink>
              </nav>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>
  </header>
</template>
