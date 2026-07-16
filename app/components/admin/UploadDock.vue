<script setup lang="ts">
const { t } = useI18n()
const task = useUploadTask()

const visible = computed(() => task.value.status !== 'idle' && !task.value.ownerVisible)

const progressPercent = computed(() =>
  task.value.total ? Math.min(100, Math.round((task.value.done / task.value.total) * 100)) : 0
)

function cancel() {
  requestUploadCancel(task)
}

function dismiss() {
  task.value.status = 'idle'
}

// Auto-dismiss a clean finish; keep failures and cancellations until acknowledged.
let dismissTimer: ReturnType<typeof setTimeout> | null = null
watch(() => task.value.status, (status) => {
  if (dismissTimer) {
    clearTimeout(dismissTimer)
    dismissTimer = null
  }
  if (status === 'done' && !task.value.errorCount && !task.value.ownerVisible) {
    dismissTimer = setTimeout(dismiss, 8_000)
  }
})

// The uploader's own tab-close guard dies when its modal unmounts; the dock
// covers background uploads since it stays mounted with the admin layout.
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (task.value.status !== 'uploading') return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (dismissTimer) clearTimeout(dismissTimer)
})
</script>

<template>
  <Transition name="udock">
    <div v-if="visible" class="udock" role="status" aria-live="polite">

      <template v-if="task.status === 'uploading'">
        <div class="udock__head">
          <div class="udock__mark" aria-hidden="true"><span /><span /><span /></div>
          <p class="udock__title">
            {{ task.cancelRequested ? t('uploader.cancelling') : t('uploadDock.uploading') }}
          </p>
          <span class="udock__count"><strong>{{ task.done }}</strong> / {{ task.total }}</span>
        </div>
        <div class="udock__meter" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ transform: `scaleX(${progressPercent / 100})` }" />
        </div>
        <div class="udock__row">
          <p v-if="task.errorCount" class="udock__errors">
            {{ t('uploader.failed', { n: task.errorCount }, task.errorCount) }}
          </p>
          <button type="button" class="udock__cancel" :disabled="task.cancelRequested" @click="cancel">
            {{ t('uploader.cancel') }}
          </button>
        </div>
      </template>

      <template v-else>
        <div class="udock__head">
          <p class="udock__title">
            {{ task.status === 'cancelled' ? t('uploadDock.cancelled') : t('uploadDock.complete') }}
          </p>
          <button type="button" class="udock__close" :aria-label="t('uploadDock.dismiss')" @click="dismiss">
            <svg width="10" height="10" viewBox="0 0 11 11" fill="none" aria-hidden="true">
              <line x1="1" y1="1" x2="10" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" />
              <line x1="10" y1="1" x2="1" y2="10" stroke="currentColor" stroke-width="1.4" stroke-linecap="square" />
            </svg>
          </button>
        </div>
        <p class="udock__summary">
          {{ t('uploadDock.uploadedCount', { n: task.uploadedCount }, task.uploadedCount) }}<template v-if="task.errorCount"> · {{ t('uploader.failed', { n: task.errorCount }, task.errorCount) }}</template><template v-if="task.cancelledCount"> · {{ t('uploader.cancelledNote', { n: task.cancelledCount }, task.cancelledCount) }}</template>
        </p>
      </template>

    </div>
  </Transition>
</template>

<style scoped>
.udock {
  position: fixed;
  right: 1.1rem;
  bottom: 1.1rem;
  z-index: 180;
  width: min(19rem, calc(100vw - 2.2rem));
  padding: 0.8rem 0.9rem 0.9rem;
  background: var(--dark);
  color: #F5F4F0;
  border: 1px solid rgba(245, 244, 240, 0.14);
  box-shadow:
    0 8px 24px rgba(26, 25, 24, 0.28),
    0 24px 48px rgba(26, 25, 24, 0.18);
}

.udock__head {
  display: flex;
  align-items: center;
  gap: 0.55rem;
}

.udock__mark {
  display: flex;
  align-items: flex-end;
  gap: 0.18rem;
  height: 0.85rem;
  flex-shrink: 0;
}
.udock__mark span {
  display: block;
  width: 0.22rem;
  height: 0.45rem;
  background: var(--accent);
  transform-origin: bottom;
  animation: udockPulse 0.85s ease-in-out infinite;
}
.udock__mark span:nth-child(2) { animation-delay: 0.12s; }
.udock__mark span:nth-child(3) { animation-delay: 0.24s; }

@keyframes udockPulse {
  0%, 100% { transform: scaleY(0.45); opacity: 0.55; }
  50% { transform: scaleY(1); opacity: 1; }
}

.udock__title {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.75);
}

.udock__count {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 300;
  color: rgba(245, 244, 240, 0.6);
  white-space: nowrap;
}
.udock__count strong {
  font-weight: 400;
  color: #F5F4F0;
}

.udock__meter {
  height: 0.28rem;
  margin-top: 0.7rem;
  background: rgba(245, 244, 240, 0.14);
  overflow: hidden;
}
.udock__meter span {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.2s ease-out;
}

.udock__row {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.75rem;
  margin-top: 0.7rem;
}

.udock__errors {
  flex: 1;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.06em;
  color: #e08a9b;
}

.udock__cancel {
  border: 1px solid rgba(245, 244, 240, 0.3);
  background: none;
  padding: 0.38rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.48rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.8);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.udock__cancel:hover:not(:disabled) {
  color: #F5F4F0;
  border-color: var(--accent);
}
.udock__cancel:disabled { opacity: 0.5; cursor: default; }

.udock__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  flex-shrink: 0;
  border: 1px solid transparent;
  background: none;
  color: rgba(245, 244, 240, 0.6);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.udock__close:hover {
  color: #F5F4F0;
  border-color: rgba(245, 244, 240, 0.3);
}

.udock__summary {
  margin-top: 0.55rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  line-height: 1.5;
  color: rgba(245, 244, 240, 0.75);
}

/* Enter/leave */
.udock-enter-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.udock-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.udock-enter-from,
.udock-leave-to { opacity: 0; transform: translateY(8px); }
</style>
