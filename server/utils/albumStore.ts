import type { Album, AlbumInput } from '~~/shared/types'

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ALBUM REPOSITORY — the single swap point for the real backend.
 *
 * This is the ONLY module that knows where albums are stored. Today it's an
 * in-memory store (resets when the dev server restarts; not synced to the public
 * @nuxt/content site yet). To connect the real backend later, replace the bodies
 * of these functions with DB calls and keep the signatures identical:
 *   - NuxtHub/Cloudflare  → D1 (hubDatabase()) + R2 for image uploads
 *   - Node host           → better-sqlite3 / Drizzle, local or volume storage
 * Nothing in the API routes or the admin UI needs to change.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Seed data so the admin isn't empty in dev. Mirrors a few content albums.
const seed: Album[] = [
  {
    id: 'dawn-at-lumphini',
    title: 'Dawn at Lumphini',
    category: 'Street',
    date: 'April 2025',
    published: '2025-04-12',
    location: 'Lumphini Park',
    excerpt: 'Members gathered before sunrise to watch the park become itself in the first gold light.',
    style: 'essay',
    placement: 'gallery',
    coverIndex: 0,
    images: [
      { src: 'https://picsum.photos/seed/dawnlumphini_1/1000/750', caption: 'First light over the lake' },
      { src: 'https://picsum.photos/seed/dawnlumphini_2/1000/750', caption: 'The eastern path, empty' },
      { src: 'https://picsum.photos/seed/dawnlumphini_3/1000/750', caption: 'A runner passes' }
    ]
  },
  {
    id: 'faces-of-siam',
    title: 'Faces of Siam',
    category: 'Portrait',
    date: 'March 2025',
    published: '2025-03-20',
    location: 'Central Bangkok',
    excerpt: 'A series of environmental portraits made across the markets and sois of central Bangkok.',
    style: 'sticky',
    placement: 'gallery',
    coverIndex: 0,
    images: [
      { src: 'https://picsum.photos/seed/facessiam_1/1000/750', caption: 'Vendor, morning' },
      { src: 'https://picsum.photos/seed/facessiam_2/1000/750', caption: 'At the loom' }
    ]
  }
]

// Module-scoped store (in-memory). Replace with a real DB — see header.
const albums = new Map<string, Album>(seed.map(a => [a.id, a]))

export const albumStore = {
  list(): Album[] {
    return [...albums.values()].sort((a, b) => b.published.localeCompare(a.published))
  },

  get(id: string): Album | null {
    return albums.get(id) ?? null
  },

  create(input: AlbumInput): Album {
    let id = slugify(input.title) || `album-${Date.now()}`
    if (albums.has(id)) id = `${id}-${Date.now().toString(36)}`
    const album: Album = { ...input, id }
    albums.set(id, album)
    return album
  },

  update(id: string, input: AlbumInput): Album | null {
    if (!albums.has(id)) return null
    const album: Album = { ...input, id }
    albums.set(id, album)
    return album
  },

  remove(id: string): boolean {
    return albums.delete(id)
  }
}
