import type { H3Event } from 'h3'
import type { Role } from '../../shared/types'

// Require a logged-in admin; returns the session user.
export async function requireAdmin(event: H3Event) {
  const { user } = await requireUserSession(event)
  return user
}

// Require the user to hold one of the given roles.
export async function requireRole(event: H3Event, roles: Role[]) {
  const { user } = await requireUserSession(event)
  if (!roles.includes(user.role)) {
    throw createError({ statusCode: 403, message: 'คุณไม่มีสิทธิ์เข้าถึงส่วนนี้' })
  }
  return user
}

// owner/admin only — manages users + settings.
export function requireManageUsers(event: H3Event) {
  return requireRole(event, ['owner', 'admin'])
}
