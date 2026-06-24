// Shared types used by both the Nuxt app (client) and the Nitro server.

export interface AlbumImage {
  src: string
  caption?: string
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
  coverIndex: number
  images: AlbumImage[]
}

/** Fields the admin supplies when creating/updating (no id). */
export type AlbumInput = Omit<Album, 'id'>
