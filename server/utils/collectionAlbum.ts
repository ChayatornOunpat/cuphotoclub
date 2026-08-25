import type { Album, AlbumRow } from '~~/shared/types'
import { eq } from 'drizzle-orm'

// The bridge between a photo collection and the album its approved photos land
// in. Everything that touches that linkage goes through here so the rules are
// written once.
//
// Two facts, deliberately kept apart:
//
//   • `review` on the submission — the admin's DECISION. Stored, so a pass
//     resumes after a refresh and a reversal is possible days later.
//   • whether the album currently CONTAINS the copy — derived by matching
//     `albumKey` against the album's cell srcs.
//
// They can legitimately disagree: an editor removing an image during layout is
// not un-deciding it. Surfacing the disagreement is the point; collapsing them
// into one flag is what made the old album-level `publishedTo` lie.

/** Where an approved copy of this submission lives inside its album. */
export function albumKeyFor(albumId: string, hash: string, type: string) {
  const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg').toLowerCase()
  return `content-albums/${albumId}/${sanitizeUploadHash(hash) || crypto.randomUUID()}.${ext}`
}

/** Every image src currently placed on an album's canvas, normalised to keys. */
export function albumImageKeys(album: Album | null): Set<string> {
  const keys = new Set<string>()
  if (!album) return keys
  for (const row of album.rows) {
    for (const cell of row.cells) {
      if (cell.type !== 'image' || !cell.src) continue
      keys.add(cell.src.replace(/^\/images\//, ''))
    }
  }
  return keys
}

/**
 * A submission is *in the album* when the album still shows its copy.
 * A legacy row (approved before `albumKey` existed) has no key to match, so it
 * counts as present rather than being reported as missing on a guess.
 */
export function isInAlbum(albumKey: string | null, keys: Set<string>) {
  return albumKey ? keys.has(albumKey) : true
}

/** The album a collection feeds, or null when none is linked / it was deleted. */
export async function linkedAlbum(albumId: string | null) {
  if (!albumId) return null
  return await albumStore.get(albumId)
}

/**
 * The collection's album, creating it on first use.
 *
 * Created as a draft titled after the collection, so the destination exists
 * before the first approval and the admin never picks one mid-review. Called
 * from approve rather than from collection creation as well, so collections
 * made before this feature — and any whose album was deleted — heal on use.
 */
export async function ensureCollectionAlbum(link: { id: string, label: string, albumId: string | null }) {
  const existing = await linkedAlbum(link.albumId)
  if (existing) return existing

  const draft = await albumStore.createDraft()
  const album = await albumStore.update(draft.id, { ...draft, title: link.label }) ?? draft
  await db
    .update(schema.collectionLinks)
    .set({ albumId: album.id, updatedAt: new Date() })
    .where(eq(schema.collectionLinks.id, link.id))
  return album
}

/** One full-width image row — how a fresh import lands on the canvas. */
export function albumRowFor(key: string, caption: string | null, credit: string | null): AlbumRow {
  const text = [caption, credit && `© ${credit}`].filter(Boolean).join(' · ')
  return {
    cells: [{
      type: 'image' as const,
      span: 6 as const,
      src: `/images/${key}`,
      ...(text ? { caption: text } : {})
    }]
  }
}

/**
 * How this contributor is credited on a published photo.
 *
 * The name field is explicitly the credit field ("how we credit you if we
 * publish it"), so a name is consent. A handle is only usable when they turned
 * the switch on — which is the whole point of collecting it. Someone who left
 * their name blank and consented to their handle gets the handle; before this
 * existed they were silently published as anonymous.
 */
export function creditFor(contributor: {
  displayName: string | null
  contact: string | null
  creditHandle: boolean | null
}) {
  if (contributor.displayName?.trim()) return contributor.displayName.trim()
  if (contributor.creditHandle && contributor.contact?.trim()) return contributor.contact.trim()
  return null
}
