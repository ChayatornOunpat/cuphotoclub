# CU Photo Club — Build Roadmap

Living roadmap for the cuphotoclub site. Full reasoning lives in the approved plan;
this is the in-repo working copy.

## What this is

Website for the CU photography club, modeled on tuphotoclub.com (Home / Gallery / Blog /
Activity / Contact + event photo galleries) plus an **About** page, a reorganized custom UI, and
a full **admin system** so club staff manage all content through a web UI.

## Decisions (v1)

| Area | Decision |
|------|----------|
| Content storage | D1 (database) + R2 (blob/photos), admin-managed via UI |
| Repo / admin | Single Nuxt app; admin under protected `/admin`; one Nitro backend |
| Admin auth | Google OAuth (email allow-list) **and** seeded email+password |
| Shop | Deferred; schema left extensible |
| Languages | Thai only, i18n-ready (copy centralized in `app/utils/strings.ts`) |
| Gallery photos | View-only lightbox, no full-res download |
| Photo volume | Dozens/event, simple multi-file upload |
| Events | Informational + optional external register link |

## Stack

Nuxt 4 (SSR) + Nitro · pnpm · NuxtHub → Cloudflare (D1 / R2 / KV) · nuxt-auth-utils ·
Drizzle ORM · Zod · Tailwind v4 + Headless UI (Tailwind Plus UI Blocks) · @nuxt/image/fonts/icon.

## Design system

- Build from **Tailwind Plus UI Blocks**; hand-build equivalents in the same style for paid/missing ones.
- Palette: white paper, soft-black ink (zinc-900/600), **faint pink** accent (`--color-accent`), defined in `app/assets/css/main.css`.
- Thai-capable fonts via @nuxt/fonts.
- Components split into `app/components/{ui,public,admin}/`; pages stay thin.

## Data model (`server/database/schema.ts`)

`users` (also the allow-list) · `albums` · `photos` · `posts` · `events` · `pages` (e.g. About) ·
`contact_messages` · `settings`. Reserved for later: `products`/`orders` (shop), English columns.

## Phases

- **Phase 0 — Foundations** ✅/in progress: Tailwind + tokens, NuxtHub db/blob/kv, Drizzle schema +
  migration, db util, dev owner seed, auth/oauth config, base layouts + home.
- **Phase 1 — Auth & admin shell**: login (Google + password), session, role middleware, admin
  layout + dashboard, user/allow-list management.
- **Phase 2 — Content domains**: albums + photo upload/lightbox → blog → events → About editor →
  contact (form + inbox) → settings. Draft/publish.
- **Phase 3 — Public polish**: home composition, nav/footer from settings, search, SEO, a11y, perf.
- **Phase 4 — Hardening & deploy**: zod coverage, rate limiting, error pages, NuxtHub deploy, smoke test.

## Local dev

```bash
pnpm install
pnpm dev          # NuxtHub emulates D1/R2/KV locally; migrations auto-apply; owner auto-seeds
```

Regenerate migrations after editing the schema:

```bash
npx drizzle-kit generate
```
