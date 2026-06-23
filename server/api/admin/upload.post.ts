const MAX_BYTES = 15 * 1024 * 1024

// Generic single-image upload → returns { key }. Used for post/event cover images.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const form = await readMultipartFormData(event)
  const file = form?.find(p => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 400, message: 'ไม่พบไฟล์' })

  const type = file.type || ''
  if (!type.startsWith('image/')) throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, message: 'ไฟล์ใหญ่เกิน 15MB' })

  const prefix = (form?.find(p => p.name === 'prefix')?.data?.toString() || 'covers').replace(/[^a-z0-9/_-]/gi, '') || 'covers'
  const ext = (file.filename?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const key = `${prefix}/${crypto.randomUUID()}.${ext}`

  await blob.put(key, file.data, { contentType: type })
  return { key }
})
