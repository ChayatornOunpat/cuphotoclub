// Serves blobs from R2 (view-only). Public URL: /images/<r2Key>
export default defineEventHandler(async (event) => {
  const pathname = getRouterParam(event, 'pathname')
  if (!pathname) throw createError({ statusCode: 400, message: 'ไม่พบรูปภาพ' })

  setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable')
  return blob.serve(event, pathname)
})
