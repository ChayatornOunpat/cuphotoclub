// Album text faces — the catalogue behind the editor's font dropdown.
//
// `value` is what lands in the database (album.textDefaults.font and
// cell.font) *and* the CSS class suffix: every entry needs a matching
// `.afont--<value>` rule in app/assets/css/album-fonts.css. That stylesheet is
// the only place the family names appear in CSS, and @nuxt/fonts provisions a
// Google family by scanning real CSS — so an entry without a rule renders in
// the browser default and is never self-hosted. Keep the two in step.
//
// `serif` and `sans` are the two original values and must keep their meaning:
// existing albums store them, and they resolve to the site's own type pairing
// (var(--font-serif) / var(--font-sans)), including the Thai swap main.css
// applies under html:lang(th).

export type AlbumFontGroup = 'editorial' | 'thai' | 'latin' | 'system'

/** Which script the face was drawn for — drives the specimen shown in the picker. */
export type AlbumFontScript = 'thai' | 'latin'

export interface AlbumFontDef {
  readonly value: AlbumFontValue
  /** Family name as the foundry writes it. Proper noun — never translated. */
  readonly label?: string
  /** i18n key, for the handful of entries named by role rather than by family. */
  readonly labelKey?: string
  readonly group: AlbumFontGroup
  readonly script: AlbumFontScript
}

// Declared `as const` so `value` stays a literal union, then re-exported as a
// plain array: consumers read `label`/`labelKey` off any entry, which the
// per-entry literal types would otherwise forbid.
const FONT_DEFS = [
  // ── The site's own pairing ──────────────────────────────────────────────
  { value: 'serif', labelKey: 'adminForm.cellFontSerif', group: 'editorial', script: 'latin' },
  { value: 'sans', labelKey: 'adminForm.cellFontSans', group: 'editorial', script: 'latin' },

  // ── Thai ────────────────────────────────────────────────────────────────
  { value: 'noto-serif-thai', label: 'Noto Serif Thai', group: 'thai', script: 'thai' },
  { value: 'noto-sans-thai', label: 'Noto Sans Thai', group: 'thai', script: 'thai' },
  { value: 'noto-sans-thai-looped', label: 'Noto Sans Thai Looped', group: 'thai', script: 'thai' },
  { value: 'ibm-plex-sans-thai', label: 'IBM Plex Sans Thai', group: 'thai', script: 'thai' },
  { value: 'ibm-plex-sans-thai-looped', label: 'IBM Plex Sans Thai Looped', group: 'thai', script: 'thai' },
  { value: 'sarabun', label: 'Sarabun', group: 'thai', script: 'thai' },
  { value: 'anuphan', label: 'Anuphan', group: 'thai', script: 'thai' },
  { value: 'bai-jamjuree', label: 'Bai Jamjuree', group: 'thai', script: 'thai' },
  { value: 'chakra-petch', label: 'Chakra Petch', group: 'thai', script: 'thai' },
  { value: 'kanit', label: 'Kanit', group: 'thai', script: 'thai' },
  { value: 'krub', label: 'Krub', group: 'thai', script: 'thai' },
  { value: 'prompt', label: 'Prompt', group: 'thai', script: 'thai' },
  { value: 'mitr', label: 'Mitr', group: 'thai', script: 'thai' },
  { value: 'niramit', label: 'Niramit', group: 'thai', script: 'thai' },
  { value: 'pridi', label: 'Pridi', group: 'thai', script: 'thai' },
  { value: 'maitree', label: 'Maitree', group: 'thai', script: 'thai' },
  { value: 'taviraj', label: 'Taviraj', group: 'thai', script: 'thai' },
  { value: 'trirong', label: 'Trirong', group: 'thai', script: 'thai' },
  { value: 'athiti', label: 'Athiti', group: 'thai', script: 'thai' },
  { value: 'fahkwang', label: 'Fahkwang', group: 'thai', script: 'thai' },
  { value: 'kodchasan', label: 'Kodchasan', group: 'thai', script: 'thai' },
  { value: 'koho', label: 'KoHo', group: 'thai', script: 'thai' },
  { value: 'k2d', label: 'K2D', group: 'thai', script: 'thai' },
  { value: 'thasadith', label: 'Thasadith', group: 'thai', script: 'thai' },
  { value: 'mali', label: 'Mali', group: 'thai', script: 'thai' },
  { value: 'itim', label: 'Itim', group: 'thai', script: 'thai' },
  { value: 'sriracha', label: 'Sriracha', group: 'thai', script: 'thai' },
  { value: 'charm', label: 'Charm', group: 'thai', script: 'thai' },
  { value: 'charmonman', label: 'Charmonman', group: 'thai', script: 'thai' },
  { value: 'chonburi', label: 'Chonburi', group: 'thai', script: 'thai' },
  { value: 'pattaya', label: 'Pattaya', group: 'thai', script: 'thai' },
  { value: 'srisakdi', label: 'Srisakdi', group: 'thai', script: 'thai' },

  // ── Latin ───────────────────────────────────────────────────────────────
  // Thai glyphs fall through to Noto (see album-fonts.css), so a bilingual
  // paragraph stays readable rather than dropping to the browser default.
  { value: 'playfair', label: 'Playfair Display', group: 'latin', script: 'latin' },
  { value: 'libre-baskerville', label: 'Libre Baskerville', group: 'latin', script: 'latin' },
  { value: 'eb-garamond', label: 'EB Garamond', group: 'latin', script: 'latin' },
  { value: 'cormorant', label: 'Cormorant Garamond', group: 'latin', script: 'latin' },
  { value: 'lora', label: 'Lora', group: 'latin', script: 'latin' },
  { value: 'crimson-pro', label: 'Crimson Pro', group: 'latin', script: 'latin' },
  { value: 'source-serif', label: 'Source Serif 4', group: 'latin', script: 'latin' },
  { value: 'dm-sans', label: 'DM Sans', group: 'latin', script: 'latin' },
  { value: 'work-sans', label: 'Work Sans', group: 'latin', script: 'latin' },
  { value: 'space-grotesk', label: 'Space Grotesk', group: 'latin', script: 'latin' },
  { value: 'manrope', label: 'Manrope', group: 'latin', script: 'latin' },
  { value: 'archivo', label: 'Archivo', group: 'latin', script: 'latin' },
  { value: 'jetbrains-mono', label: 'JetBrains Mono', group: 'latin', script: 'latin' },
  { value: 'courier-prime', label: 'Courier Prime', group: 'latin', script: 'latin' },

  // ── System ──────────────────────────────────────────────────────────────
  // Nothing to download: these resolve to whatever the reader's OS ships, so
  // they cost no bytes but look different on every machine.
  { value: 'system-ui', labelKey: 'adminForm.fontSystemUi', group: 'system', script: 'latin' },
  { value: 'system-sans', labelKey: 'adminForm.fontSystemSans', group: 'system', script: 'latin' },
  { value: 'system-serif', labelKey: 'adminForm.fontSystemSerif', group: 'system', script: 'latin' },
  { value: 'system-mono', labelKey: 'adminForm.fontSystemMono', group: 'system', script: 'latin' },
  { value: 'system-thai', labelKey: 'adminForm.fontSystemThai', group: 'system', script: 'thai' },
  { value: 'system-thai-ui', labelKey: 'adminForm.fontSystemThaiUi', group: 'system', script: 'thai' },
  { value: 'system-thai-classic', labelKey: 'adminForm.fontSystemThaiClassic', group: 'system', script: 'thai' }
] as const

export type AlbumFontValue = typeof FONT_DEFS[number]['value']

export const ALBUM_FONTS: readonly AlbumFontDef[] = FONT_DEFS

export const ALBUM_FONT_VALUES = FONT_DEFS.map(font => font.value) as [AlbumFontValue, ...AlbumFontValue[]]

export const ALBUM_FONT_GROUPS: readonly AlbumFontGroup[] = ['editorial', 'thai', 'latin', 'system']

export const DEFAULT_ALBUM_FONT: AlbumFontValue = 'serif'

const VALUE_SET = new Set<string>(ALBUM_FONT_VALUES)

export function isAlbumFont(value: unknown): value is AlbumFontValue {
  return typeof value === 'string' && VALUE_SET.has(value)
}

/**
 * CSS class for a stored font value. Unknown values (an album written before a
 * face was retired, say) fall back to the site serif rather than to whatever
 * the browser picks, so old albums keep rendering as editorial text.
 */
export function albumFontClass(value?: string | null): string {
  return `afont--${isAlbumFont(value) ? value : DEFAULT_ALBUM_FONT}`
}
