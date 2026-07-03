interface AuditInput {
  action: string
  entityType: string
  entityId: string | number
  entityTitle?: string | null
  metadata?: Record<string, unknown>
}

interface AuditActor {
  id: number
  email: string
  name?: string | null
}

export async function recordAdminAudit(actor: AuditActor, input: AuditInput) {
  await db.insert(schema.adminAuditLogs).values({
    actorId: actor.id,
    actorEmail: actor.email,
    actorName: actor.name ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: String(input.entityId),
    entityTitle: input.entityTitle ?? null,
    metadata: input.metadata ?? {}
  })
}
