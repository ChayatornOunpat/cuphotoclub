// Prefixes whose objects are never public, shared by the /images/ gate and by
// any admin surface that has to render them anyway.
//
// Nothing a participant uploads is legitimately public: publishing COPIES the
// object out into the album's own folder, so a key still under this prefix is by
// definition unpublished. Keeping the constant here means the public route and
// the admin thumbnails can't drift apart on what counts as private.
export const PRIVATE_R2_PREFIX = 'contributions/'

export function isPrivateR2Key(key: string): boolean {
  return key.replace(/^\/+/, '').startsWith(PRIVATE_R2_PREFIX)
}
