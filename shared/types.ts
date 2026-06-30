// Shared types used by both the Nuxt app (client) and the Nitro server.

export type Role = 'owner' | 'admin' | 'editor'
export type ContentStatus = 'draft' | 'published'

export const ROLES: Role[] = ['owner', 'admin', 'editor']

// owner/admin can manage users + settings; editor manages content only.
export function canManageUsers(role: Role): boolean {
  return role === 'owner' || role === 'admin'
}

export type CellSpan = 2 | 3 | 4 | 6
export type CellType = 'image' | 'text' | 'pad'

export interface AlbumCell {
  type: CellType
  span: CellSpan
  src?: string       // image cells
  caption?: string   // image cells
  content?: string   // text cells
}

export interface AlbumRow {
  cells: AlbumCell[]
}

export type AlbumStyle = 'essay' | 'sticky' | 'contact'
export type Placement = 'blog' | 'gallery' | 'both'

export interface Album {
  id: string
  title: string
  category: string
  date: string // human display, e.g. "March 2025"
  published: string // ISO date (sorting)
  location?: string
  excerpt: string
  style: AlbumStyle
  placement: Placement
  coverSrc: string       // URL of the cover/hero image
  rows: AlbumRow[]       // ordered content rows
}

/** Fields the admin supplies when creating/updating (no id). */
export type AlbumInput = Omit<Album, 'id'>

export interface Post {
  id: string
  title: string
  tag: string
  date: string
  published: string
  image: string
  excerpt: string
  body: string
}

/** Fields the admin supplies when creating/updating (no id). */
export type PostInput = Omit<Post, 'id'>

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
