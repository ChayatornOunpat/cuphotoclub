// Measures a cover image's natural aspect ratio client-side and classifies it.
// Portrait/square covers get the blurred-backdrop + floating-subject hero
// treatment in the album styles; landscape covers render full-bleed.
export type CoverOrientation = 'landscape' | 'portrait' | 'square'

export function useCoverOrientation(src: () => string | undefined) {
  const coverAspect = ref<number | null>(null)
  let measureId = 0

  const coverOrientation = computed<CoverOrientation>(() => {
    const aspect = coverAspect.value
    if (!aspect) return 'landscape'
    if (aspect < 0.82) return 'portrait'
    if (aspect < 1.18) return 'square'
    return 'landscape'
  })

  function measure(value?: string) {
    const id = ++measureId
    coverAspect.value = null
    if (!import.meta.client || !value) return

    const img = new Image()
    img.onload = () => {
      if (id !== measureId) return
      const width = img.naturalWidth || img.width
      const height = img.naturalHeight || img.height
      coverAspect.value = width > 0 && height > 0 ? width / height : null
    }
    img.onerror = () => {
      if (id === measureId) coverAspect.value = null
    }
    img.src = value
  }

  watch(src, measure, { immediate: true })

  return { coverOrientation, coverAspect }
}
