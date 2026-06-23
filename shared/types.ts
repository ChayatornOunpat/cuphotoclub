// Shared types used on both client and server.

export type Role = 'owner' | 'admin' | 'editor'
export type ContentStatus = 'draft' | 'published'

export const ROLES: Role[] = ['owner', 'admin', 'editor']

// owner/admin can manage users + settings; editor manages content only.
export function canManageUsers(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

// Shape of the authenticated user stored in the session by nuxt-auth-utils.
declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name?: string | null
    role: Role
    avatarUrl?: string | null
  }
}

export {}
