import type { Ref } from 'vue'

// Minimal focus trap for modal dialogs (album lightboxes): while active, Tab
// cycles inside the container; on activation focus moves to the first control,
// and on deactivation it returns to the element that was focused before.
export function useFocusTrap(container: Ref<HTMLElement | null>, active: Ref<boolean>) {
  let restoreTo: HTMLElement | null = null

  function focusables(): HTMLElement[] {
    const root = container.value
    if (!root) return []
    return [...root.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )].filter(el => !el.hasAttribute('disabled'))
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return
    const els = focusables()
    if (!els.length) return
    const first = els[0]!
    const last = els[els.length - 1]!
    const current = document.activeElement as HTMLElement | null
    const inside = current ? container.value?.contains(current) : false
    if (e.shiftKey && (current === first || !inside)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && (current === last || !inside)) {
      e.preventDefault()
      first.focus()
    }
  }

  watch(active, (value) => {
    if (!import.meta.client) return
    if (value) {
      restoreTo = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown, true)
      nextTick(() => focusables()[0]?.focus())
    } else {
      document.removeEventListener('keydown', onKeydown, true)
      restoreTo?.focus()
      restoreTo = null
    }
  })

  onUnmounted(() => {
    if (import.meta.client) document.removeEventListener('keydown', onKeydown, true)
  })
}
