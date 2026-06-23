// Thai-locale date helpers (auto-imported across the app).
export function formatDate(value?: string | number | Date | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(value?: string | number | Date | null): string {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}
