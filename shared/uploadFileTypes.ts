// Extensions the upload pipeline (admin + contribute) accepts. Raw camera
// formats (.cr2, .nef, .arw, .dng, ...) are excluded on purpose: nothing in the
// pipeline can render them (album walls, hero images, /cdn-cgi/image transforms
// all assume a browser-displayable image), and MIME-type sniffing alone lets
// them through because browsers often report no MIME type at all for raw files.
export const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  'jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'heif'
])

export function isAllowedUploadExt(ext: string) {
  return ALLOWED_UPLOAD_EXTENSIONS.has(ext.toLowerCase().replace(/[^a-z0-9]/g, ''))
}
