import { asc, eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  return db
    .select({
      id:         schema.members.id,
      nickname:   schema.members.nickname,
      photoR2Key: schema.members.photoR2Key,
      schoolYear: schema.members.schoolYear,
      position:   schema.members.position,
      instagram:  schema.members.instagram,
      bio:        schema.members.bio,
      interests:  schema.members.interests,
      featuredLinks: schema.members.featuredLinks,
      sortOrder:  schema.members.sortOrder
    })
    .from(schema.members)
    .where(eq(schema.members.active, true))
    .orderBy(asc(schema.members.schoolYear), asc(schema.members.sortOrder), asc(schema.members.createdAt))
})
