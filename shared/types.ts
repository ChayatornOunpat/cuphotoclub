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

// ─── Post block types ──────────────────────────────────────────────────────

export type PostBlockType =
  | 'text' | 'lead' | 'heading' | 'subheading'
  | 'pullquote' | 'blockquote' | 'image'
  | 'photo-full' | 'photo-pair' | 'divider'
  | 'inset' | 'qanda'

interface PostBlockBase { id: string; type: PostBlockType }

export interface PostBlockText       extends PostBlockBase { type: 'text';       content: string }
export interface PostBlockLead       extends PostBlockBase { type: 'lead';       content: string }
export interface PostBlockHeading    extends PostBlockBase { type: 'heading';    content: string }
export interface PostBlockSubheading extends PostBlockBase { type: 'subheading'; content: string }
export interface PostBlockPullquote  extends PostBlockBase { type: 'pullquote';  content: string }
export interface PostBlockBlockquote extends PostBlockBase { type: 'blockquote'; content: string; cite?: string }
export interface PostBlockImage      extends PostBlockBase { type: 'image';      src: string; caption?: string; breakout?: boolean }
export interface PostBlockPhotoFull  extends PostBlockBase { type: 'photo-full'; src: string; caption?: string }
export interface PostBlockPhotoPair  extends PostBlockBase { type: 'photo-pair'; src1: string; src2: string; caption?: string }
export interface PostBlockDivider    extends PostBlockBase { type: 'divider' }
export interface PostBlockInset      extends PostBlockBase { type: 'inset';      content: string }
export interface PostBlockQanda      extends PostBlockBase { type: 'qanda';      question: string; answer: string }

export type PostBlock =
  | PostBlockText | PostBlockLead | PostBlockHeading | PostBlockSubheading
  | PostBlockPullquote | PostBlockBlockquote | PostBlockImage
  | PostBlockPhotoFull | PostBlockPhotoPair | PostBlockDivider
  | PostBlockInset | PostBlockQanda

// ─── Post ──────────────────────────────────────────────────────────────────

export type HeroStyle = 'standard' | 'dark-full' | 'split' | 'minimal-dark'

export interface Post {
  id: string
  title: string
  tag: string
  date: string
  published: string
  image: string
  excerpt: string
  heroStyle?: HeroStyle
  author?: string
  authorBio?: string
  authorAvatar?: string
  blocks: PostBlock[]
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
