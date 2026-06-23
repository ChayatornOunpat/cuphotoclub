<script setup lang="ts">
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'

const mobileOpen = ref(false)
const route = useRoute()
watch(() => route.path, () => { mobileOpen.value = false })
</script>

<template>
  <div class="min-h-screen bg-paper-soft">
    <!-- Mobile slide-over sidebar -->
    <TransitionRoot :show="mobileOpen" as="template">
      <Dialog class="relative z-50 lg:hidden" @close="mobileOpen = false">
        <TransitionChild
          as="template"
          enter="transition-opacity ease-linear duration-200" enter-from="opacity-0" enter-to="opacity-100"
          leave="transition-opacity ease-linear duration-150" leave-from="opacity-100" leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-ink/40" />
        </TransitionChild>
        <div class="fixed inset-0 flex">
          <TransitionChild
            as="template"
            enter="transition ease-in-out duration-200 transform" enter-from="-translate-x-full" enter-to="translate-x-0"
            leave="transition ease-in-out duration-150 transform" leave-from="translate-x-0" leave-to="-translate-x-full"
          >
            <DialogPanel class="relative flex w-72 max-w-[80%] flex-col bg-white py-4">
              <div class="px-6 pb-4">
                <NuxtLink to="/admin" class="text-lg font-semibold text-ink">{{ strings.brand }}</NuxtLink>
                <p class="text-xs text-ink-soft">ระบบจัดการ</p>
              </div>
              <AdminSidebar />
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </TransitionRoot>

    <!-- Desktop sidebar -->
    <aside class="hidden border-r border-line bg-white py-4 lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
      <div class="px-6 pb-4">
        <NuxtLink to="/admin" class="text-lg font-semibold text-ink">{{ strings.brand }}</NuxtLink>
        <p class="text-xs text-ink-soft">ระบบจัดการ</p>
      </div>
      <AdminSidebar />
    </aside>

    <div class="lg:pl-72">
      <header class="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-line bg-white/80 px-4 backdrop-blur sm:px-6">
        <button type="button" class="lg:hidden" aria-label="เปิดเมนู" @click="mobileOpen = true">
          <Icon name="heroicons:bars-3" class="size-6 text-ink" />
        </button>
        <div class="flex-1" />
        <AdminUserMenu />
      </header>
      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <slot />
      </main>
    </div>
  </div>
</template>
