import { inArray } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const rows = await db
    .select()
    .from(schema.settings)
    .where(inArray(schema.settings.key, ['historyImage', 'clubroomImage']))
  const values = new Map(rows.map(row => [row.key, row.value]))

  return {
    historyImage: decodeManagedImage(values.get('historyImage')),
    clubroomImage: decodeManagedImage(values.get('clubroomImage'))
  }
})
