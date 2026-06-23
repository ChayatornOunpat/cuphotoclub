<script setup lang="ts">
import { Dialog, DialogPanel, TransitionChild, TransitionRoot } from '@headlessui/vue'

interface Photo {
  id: number
  r2Key: string
  width: number | null
  height: number | null
  caption: string | null
  photographer: string | null
  alt: string | null
}

const props = defineProps<{ photos: Photo[] }>()
// v-model:index — null = closed, otherwise the open photo index.
const index = defineModel<number | null>('index', { default: null })

const open = computed(() => index.value !== null)
const current = computed(() => (index.value !== null ? props.photos[index.value] : null))

function close() { index.value = null }
function prev() {
  if (index.value !== null) index.value = (index.value - 1 + props.photos.length) % props.photos.length
}
function next() {
  if (index.value !== null) index.value = (index.value + 1) % props.photos.length
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft') prev()
  else if (e.key === 'ArrowRight') next()
}

watch(open, (v) => {
  if (!import.meta.client) return
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onUnmounted(() => {
  if (import.meta.client) window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="relative z-50" @close="close">
      <TransitionChild
        as="template"
        enter="duration-200 ease-out" enter-from="opacity-0" enter-to="opacity-100"
        leave="duration-150 ease-in" leave-from="opacity-100" leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-ink/90" />
      </TransitionChild>

      <div class="fixed inset-0 flex items-center justify-center p-4 sm:p-10">
        <!-- close -->
        <button type="button" class="absolute right-4 top-4 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white" @click="close">
          <Icon name="heroicons:x-mark" class="size-6" />
        </button>
        <!-- prev / next -->
        <button v-if="photos.length > 1" type="button" class="absolute left-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white sm:left-4" @click="prev">
          <Icon name="heroicons:chevron-left" class="size-7" />
        </button>
        <button v-if="photos.length > 1" type="button" class="absolute right-2 rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white sm:right-4" @click="next">
          <Icon name="heroicons:chevron-right" class="size-7" />
        </button>

        <TransitionChild
          as="template"
          enter="duration-200 ease-out" enter-from="opacity-0 scale-95" enter-to="opacity-100 scale-100"
          leave="duration-150 ease-in" leave-from="opacity-100 scale-100" leave-to="opacity-0 scale-95"
        >
          <DialogPanel class="flex max-h-full max-w-5xl flex-col items-center">
            <img
              v-if="current"
              :src="`/images/${current.r2Key}`"
              :alt="current.alt || current.caption || ''"
              class="max-h-[80vh] w-auto rounded-md object-contain"
            >
            <div v-if="current && (current.caption || current.photographer)" class="mt-3 text-center text-sm text-white/80">
              <span v-if="current.caption">{{ current.caption }}</span>
              <span v-if="current.photographer" class="text-white/60"> · 📷 {{ current.photographer }}</span>
            </div>
          </DialogPanel>
        </TransitionChild>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
