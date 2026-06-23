<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'

const open = defineModel<boolean>({ default: false })
defineProps<{ title?: string }>()
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="relative z-50" @close="open = false">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100"
        leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-ink/40 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 w-screen overflow-y-auto">
        <div class="flex min-h-full items-center justify-center p-4">
          <TransitionChild
            as="template"
            enter="duration-200 ease-out" enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95" enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="duration-150 ease-in" leave-from="opacity-100 translate-y-0 sm:scale-100" leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <DialogTitle v-if="title" class="text-base font-semibold text-ink">{{ title }}</DialogTitle>
              <div :class="title ? 'mt-4' : ''">
                <slot />
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
