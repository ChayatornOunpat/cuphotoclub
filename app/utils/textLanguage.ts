const THAI_RE = /[\u0E00-\u0E7F]/

export function textLang(value: string | null | undefined): 'th' | undefined {
  return value && THAI_RE.test(value) ? 'th' : undefined
}
