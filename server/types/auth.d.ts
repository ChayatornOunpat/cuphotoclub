// Shape of the authenticated user stored in the session by nuxt-auth-utils.
// Kept out of shared/types.ts: the standalone `shared` TS project cannot
// resolve the #auth-utils augmentation target and fails with TS2664 there.
// Mirror of app/types/auth.d.ts — keep both in sync.
import type { Role } from '~~/shared/types'

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
