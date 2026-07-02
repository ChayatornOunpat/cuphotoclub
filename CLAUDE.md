# CU Photo Club — Claude Instructions

## Styling rules

**Admin pages use scoped CSS + CSS variables — never Tailwind utilities.**
All admin pages (`app/pages/admin/**`, `app/components/Admin*.vue`) use `<style scoped>` with BEM class names and CSS variables (`var(--dark)`, `var(--muted)`, `var(--subtle)`, `var(--paper)`, `var(--accent)`). Tailwind utility classes are used only on public-facing pages. If you write `text-ink`, `border-line`, or `bg-paper-soft` in an admin template, those classes don't exist — they'll silently break.

## i18n rule

Every user-facing string (admin and public) must go through `useI18n()` / `t()`. Add keys to **both** `i18n/locales/en.json` and `i18n/locales/th.json`. Never hardcode Thai or English directly in templates.

## Admin role/middleware system

| Middleware | Server util | Who can access |
|---|---|---|
| `admin` | `requireAdmin()` | Any logged-in user |
| `admin-manage` | `requireManageUsers()` | `owner` or `admin` role only |

Use `admin-manage` / `requireManageUsers` only for user management and site settings. Content management pages (albums, posts, hero images) use `admin` / `requireAdmin` so editors can access them too.

## Key file locations

- **Admin roles**: `server/utils/auth.ts`
- **DB swap point**: `server/utils/albumStore.ts` (in-memory → real DB later)
- **Image upload**: `app/components/admin/R2ImageUploader.vue` (handles compress + queue)
- **Image picker modal**: `app/components/admin/ImagePickerModal.vue` (used by hero-images page)
- **Photos modal** (album canvas): inline in `app/components/AdminAlbumForm.vue` around line 909
- **Hero images page**: `app/pages/admin/hero-images.vue` → `/admin/hero-images`
- **Dashboard**: `app/pages/admin/index.vue`

## Upload queue behaviour

`R2ImageUploader` has a `pendingQueue` — dragging new files while an upload is running appends them; they process after the current batch finishes. Do not reset `total`/`done` counters on a concurrent call.
