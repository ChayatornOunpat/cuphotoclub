export interface PublicSettings {
  siteDescription: string
  contactEmail: string
  facebookUrl: string
  instagramUrl: string
  lineUrl: string
  footerText: string
}

const DEFAULTS: PublicSettings = {
  siteDescription: '',
  contactEmail: '',
  facebookUrl: '',
  instagramUrl: '',
  lineUrl: '',
  footerText: ''
}

export const SETTING_KEYS = Object.keys(DEFAULTS) as (keyof PublicSettings)[]

export async function getPublicSettings(): Promise<PublicSettings> {
  const rows = await db.select().from(schema.settings)
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = (r.value as string) ?? ''
  const out = { ...DEFAULTS }
  for (const k of SETTING_KEYS) if (map[k] != null) out[k] = map[k]
  return out
}
