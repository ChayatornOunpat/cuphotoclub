// The site's only date formatter (auto-imported across the app).
//
// Everything that renders a date goes through here — public pages, admin
// tables, the contribute page — so the whole site reads dates one way. Nothing
// should construct its own Intl.DateTimeFormat; if a new shape is needed, add
// it below rather than inline.
//
// Two clocks, deliberately:
//
//   • A CALENDAR DATE (an album's date, an event's date, a collection's date)
//     is a day on a wall calendar, stored as midnight UTC. It must be read back
//     in UTC or a viewer west of Greenwich sees the previous day — the club's
//     own timezone hides this, which is exactly why it survived unnoticed.
//   • A TIMESTAMP (a log entry, a message, an upload) is an instant. It is read
//     in the viewer's local time, because "when did this happen to me" is the
//     question being asked.
//
// formatDate/formatAlbumDateRange are the first; formatDateTime is the second.

function parseDate(value?: string | number | Date | null): Date | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value

  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnly) {
      const [, year, month, day] = dateOnly
      // Built in UTC so a bare "2026-11-24" and an ISO midnight-UTC timestamp
      // of the same day both come back out as the 24th.
      const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
      return Number.isNaN(date.getTime()) ? null : date
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** A calendar date, `dd/mm/yy`. Read in UTC — see the note at the top. */
export function formatDate(value?: string | number | Date | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${String(d.getUTCFullYear()).slice(-2)}`
}

export function formatAlbumDateRange(start?: string | number | Date | null, end?: string | number | Date | null): string {
  if (!start) return ''
  const startText = typeof start === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(start) ? start : formatDate(start)
  if (!end || end === start) return startText
  const endText = typeof end === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(end) ? end : formatDate(end)
  return `${startText} – ${endText}`
}

/** An instant, `dd/mm/yy hh:mm`, in the viewer's local time — date parts local
 *  too, so the day and the clock can never disagree with each other. */
export function formatDateTime(value?: string | number | Date | null): string {
  const d = parseDate(value)
  if (!d) return '—'
  const date = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`
  return `${date} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// ── Calendar scaffolding ────────────────────────────────────────────────────
// The activities calendars need month headings, weekday initials and bare day
// numbers. Those are not date *formats* — dd/mm/yy in a month heading would be
// nonsense — but they are still date rendering, so they live here rather than
// as an Intl instance built inside each component. Output is unchanged from the
// inline versions these replaced.

/** 'en' | 'th' → the BCP-47 tag the calendars format with. */
export function intlTag(locale?: string): string {
  return locale === 'th' ? 'th-TH' : 'en-GB'
}

/** "November 2026" — a calendar's month heading. */
export function formatMonthYear(value: string | number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { month: 'long', year: 'numeric' }).format(new Date(value))
}

/** "2026" — a year heading. */
export function formatYear(value: string | number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { year: 'numeric' }).format(new Date(value))
}

/** "Mon" — a weekday column header. UTC, so a midnight-UTC date keeps its day. */
export function formatWeekdayShort(value: string | number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { weekday: 'short', timeZone: 'UTC' }).format(new Date(value))
}

/** "24" — the bare day number on a calendar cell. `padded` gives "04" for the
 *  event hero, which sets the day as a large two-figure numeral. */
export function formatDayNumber(value: string | number | Date, locale?: string, padded = false): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    day: padded ? '2-digit' : 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value))
}

/** "24 Nov" — a compact date chip. */
export function formatDayMonth(value: string | number | Date, locale?: string): string {
  return new Intl.DateTimeFormat(intlTag(locale), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(value))
}

/** "Tuesday 24 November 2026" — the long form on an event page. */
export function formatLongDate(value: string | number | Date, locale?: string, withWeekday = false): string {
  return new Intl.DateTimeFormat(intlTag(locale), {
    ...(withWeekday ? { weekday: 'long' as const } : {}),
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(value))
}
