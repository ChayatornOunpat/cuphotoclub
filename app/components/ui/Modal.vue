<script setup lang="ts">
import { Dialog, DialogPanel, DialogTitle, TransitionChild, TransitionRoot } from '@headlessui/vue'

const open = defineModel<boolean>({ default: false })
defineProps<{ title?: string; size?: 'md' | 'lg' | 'xl'; flush?: boolean }>()
</script>

<template>
  <TransitionRoot :show="open" as="template">
    <Dialog class="modal-root" @close="open = false">

      <!-- Backdrop -->
      <TransitionChild
        as="template"
        enter="modal-backdrop-enter" enter-from="modal-backdrop-from" enter-to="modal-backdrop-to"
        leave="modal-backdrop-leave" leave-from="modal-backdrop-to" leave-to="modal-backdrop-from"
      >
        <div class="modal-backdrop" />
      </TransitionChild>

      <!-- Scroll container -->
      <div class="modal-scroll">
        <div class="modal-center">
          <TransitionChild
            as="template"
            enter="modal-panel-enter" enter-from="modal-panel-from" enter-to="modal-panel-to"
            leave="modal-panel-leave" leave-from="modal-panel-to" leave-to="modal-panel-from"
          >
            <DialogPanel class="modal-panel" :class="size === 'lg' ? 'modal-panel--lg' : size === 'xl' ? 'modal-panel--xl' : ''">

              <!-- Header -->
              <div v-if="title" class="modal-header">
                <DialogTitle class="modal-title">{{ title }}</DialogTitle>
                <button type="button" class="modal-close" aria-label="Close" @click="open = false">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none" aria-hidden="true">
                    <line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/>
                    <line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="square"/>
                  </svg>
                </button>
              </div>

              <!-- Body -->
              <div class="modal-body" :class="{ 'modal-body--flush': flush }">
                <slot />
              </div>

            </DialogPanel>
          </TransitionChild>
        </div>
      </div>

    </Dialog>
  </TransitionRoot>
</template>

<!-- Not scoped: Dialog teleports to <body>, scoped selectors won't reach it -->
<style>
.modal-root {
  position: relative;
  z-index: 200;
}

/* Backdrop */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(26, 25, 24, 0.72);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

/* Scroll / centering */
.modal-scroll {
  position: fixed;
  inset: 0;
  z-index: 10;
  overflow-y: auto;
  scrollbar-width: none;
}
.modal-scroll::-webkit-scrollbar { display: none; }

.modal-center {
  display: flex;
  min-height: 100%;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

/* Panel */
.modal-panel {
  position: relative;
  width: 100%;
  max-width: 28rem;
  background: var(--body-bg);
  border: 1px solid var(--subtle);
  box-shadow:
    0 2px 4px rgba(26, 25, 24, 0.04),
    0 8px 24px rgba(26, 25, 24, 0.14),
    0 32px 64px rgba(26, 25, 24, 0.1);
}

.modal-panel--lg { max-width: 54rem; }
.modal-panel--xl { max-width: 82rem; }

/* Header */
.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid var(--subtle);
}

.modal-title {
  font-family: var(--font-sans);
  font-size: 0.44rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
}

.modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid transparent;
  background: none;
  color: var(--muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.15s, border-color 0.15s;
}
.modal-close:hover {
  color: var(--dark);
  border-color: var(--subtle);
}

/* Body */
.modal-body { padding: 1rem 0.9rem 1.1rem; }
.modal-body--flush { padding: 0; }

/* Transitions — backdrop */
.modal-backdrop-enter { transition: opacity 0.22s ease; }
.modal-backdrop-leave { transition: opacity 0.16s ease; }
.modal-backdrop-from  { opacity: 0; }
.modal-backdrop-to    { opacity: 1; }

/* Transitions — panel */
.modal-panel-enter { transition: opacity 0.22s ease, transform 0.22s ease; }
.modal-panel-leave { transition: opacity 0.16s ease, transform 0.16s ease; }
.modal-panel-from  { opacity: 0; transform: translateY(8px); }
.modal-panel-to    { opacity: 1; transform: translateY(0); }
</style>
