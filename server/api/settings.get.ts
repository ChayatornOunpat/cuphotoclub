// Public site settings (socials, footer, contact email, description).
export default defineEventHandler(async () => {
  return getPublicSettings()
})
