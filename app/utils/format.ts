// Thai-style numeric date helpers (auto-imported across the app).
function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnly) {
      const [, year, month, day] = dateOnly
      const date = new Date(Number(year), Number(month) - 1, Number(day))
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatDate(value?: string | number | Date | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`
}

export function formatAlbumDateRange(start?: string | number | Date | null, end?: string | number | Date | null): string {
  if (!start) return ''
  const startText = typeof start === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : formatDate(start)
  if (!end || end === start) return startText
  const endText = typeof end === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : formatDate(end)
  return `${startText} – ${endText}`
}

export function formatDateTime(value?: string | number | Date | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}
