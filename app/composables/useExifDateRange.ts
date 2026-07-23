import exifr from 'exifr'

// Only the EXIF/APP1 header holds DateTimeOriginal, and it lives at the very
// start of a JPEG/HEIC. Reading a small head slice keeps this fast even for
// hundreds of multi-MB originals — we never decode pixels or load whole files.
const HEADER_BYTES = 128 * 1024
const READ_CONCURRENCY = 8

export interface ExifDateRangeResult {
  /** Earliest capture date, ISO YYYY-MM-DD (local time), or '' if none found. */
  start: string
  /** Latest capture date, ISO YYYY-MM-DD (local time), or '' if none found. */
  end: string
  /** Files that yielded a usable EXIF capture date. */
  withDate: number
  /** Files scanned that had no readable EXIF capture date. */
  withoutDate: number
  /** Total image files scanned. */
  total: number
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

// Format using the photo's *local* wall-clock fields. EXIF DateTimeOriginal has
// no timezone, so treating it as local (not UTC) matches what the camera showed
// and avoids day-boundary drift from toISOString().
function toLocalISODate(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

async function readCaptureDate(file: File): Promise<Date | null> {
  try {
    const slice = file.slice(0, HEADER_BYTES)
    const exif = await exifr.parse(slice, {
      // Prefer the original capture time; fall back to other timestamps.
      pick: ['DateTimeOriginal', 'CreateDate', 'ModifyDate']
    })
    const value = exif?.DateTimeOriginal ?? exif?.CreateDate ?? exif?.ModifyDate
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value
    if (typeof value === 'string') {
      const parsed = new Date(value)
      if (!Number.isNaN(parsed.getTime())) return parsed
    }
    return null
  } catch {
    // Unreadable/unsupported header (PNG, screenshots, stripped EXIF, etc.).
    return null
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const runners = Array.from(
    { length: Math.min(Math.max(concurrency, 1), items.length) },
    async () => {
      while (next < items.length) {
        const index = next++
        results[index] = await worker(items[index]!)
      }
    }
  )
  await Promise.all(runners)
  return results
}

export function useExifDateRange() {
  const scanning = ref(false)

  async function detect(files: File[] | FileList): Promise<ExifDateRangeResult> {
    const list = Array.from(files).filter(file => file.type.startsWith('image/') || /\.(jpe?g|heic|heif|tiff?|png|webp)$/i.test(file.name))
    const empty: ExifDateRangeResult = { start: '', end: '', withDate: 0, withoutDate: 0, total: list.length }
    if (!list.length) return empty

    scanning.value = true
    try {
      const dates = await mapWithConcurrency(list, READ_CONCURRENCY, readCaptureDate)
      let min: Date | null = null
      let max: Date | null = null
      let withDate = 0
      for (const date of dates) {
        if (!date) continue
        withDate++
        if (!min || date < min) min = date
        if (!max || date > max) max = date
      }
      return {
        start: min ? toLocalISODate(min) : '',
        end: max ? toLocalISODate(max) : '',
        withDate,
        withoutDate: list.length - withDate,
        total: list.length
      }
    } finally {
      scanning.value = false
    }
  }

  return { scanning, detect }
}
