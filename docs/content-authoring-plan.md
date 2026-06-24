# Content Authoring & Editor — Plan

_CU Photo Club · drafted 2026-06-23_

How an admin (a rotating club committee member, not a developer) creates polished,
on-brand posts and albums **without ever drawing a page** — no freeform page
builder, no gen-AI generating layout. The design is decided once in the mockups;
the admin only supplies content into pre-designed slots.

---

## 1. Guiding principle

**Templates own the design. The admin owns the content.**

A post/album is structured data, never HTML. A fixed set of styles (A/B/C) holds
all layout/typography decisions. The admin (a) picks a style and (b) fills
content into typed, pre-styled blocks. It is impossible to produce something
off-brand because the admin never touches layout. This is the standard CMS model
(WordPress Gutenberg, Notion, Sanity portable text) — proven, maintainable.

---

## 2. Content types and their styles

Both content types support multiple display styles, chosen per item by the admin.

### Posts (Blog — authored editorial pieces)
- **A — Classic** — [design/mockup-post-a-classic.html](../design/mockup-post-a-classic.html) — text-led single column.
- **B — Split** — [design/mockup-post-b-split.html](../design/mockup-post-b-split.html)
- **C — Photo-essay** — [design/mockup-post-c-photoessay.html](../design/mockup-post-c-photoessay.html) — image-led sequence.

### Albums (Gallery — collections of images)
- **A — Essay** — [design/mockup-album-a-essay.html](../design/mockup-album-a-essay.html)
- **B — Sticky** — [design/mockup-album-b-sticky.html](../design/mockup-album-b-sticky.html)
- **C — Contact sheet** — [design/mockup-album-c-contact.html](../design/mockup-album-c-contact.html)

### Index / container pages (not per-item styles)
- Home (merged latest) — [design/mockup-c-hybrid.html](../design/mockup-c-hybrid.html)
- Blog index — [design/mockup-blog.html](../design/mockup-blog.html)
- Albums index — [design/mockup-albums.html](../design/mockup-albums.html)

---

## 3. Core data model

A post is a record; the body is an **ordered list of typed blocks**, not markup.

```
Post {
  title, subtitle?, style: 'classic' | 'split' | 'photo-essay',
  placement: 'blog' | 'gallery' | 'both',   // default 'blog'; admin-editable anytime
  author, date, cover, tags[],         // tags ∈ Feature/Interview/Workshop/Exhibition/Community
  body: Block[]                        // ordered, typed blocks
}

Album {
  title, subtitle?, style: 'essay' | 'sticky' | 'contact',
  placement: 'blog' | 'gallery' | 'both',   // default 'gallery'; admin-editable anytime
  date, category, coverIndex,
  intro?,                              // short authored lead
  images: { src, caption? }[]          // the collection
}
```

The **style** field selects the skeleton (which render template + which blocks
are offered). The **body/images** fill it.

### Placement vs. type (two separate axes)

- **Type** (post vs album) is automatic — it decides the data shape, the editor,
  and the available styles. Not directly chosen; derived from how the item was
  created.
- **Placement** is the admin's **final say** over which index section(s) the item
  appears in. It **defaults from the type** (post → `blog`, album → `gallery`)
  but is overridable and **editable after the fact** at any time.

Placement affects **index visibility only**, never rendering: a post always
renders with its post style, an album with its album style, wherever it's listed.

- **Blog index** lists items with placement `blog` or `both`.
- **Gallery index** lists items with placement `gallery` or `both`.
- **Home "latest"** shows everything (newest first), independent of placement.

`both` covers crossovers (e.g. a standout photo-essay surfaced in both sections).

---

## 4. Block library

Each block has exactly one designed rendering. The available palette is filtered
by the chosen style.

```
paragraph    { text }
heading      { text, level }
image        { src, caption?, size: inline | wide | full-bleed }
image-pair   { left, right, caption? }
gallery      { images[] }
pull-quote   { text, attribution? }
qa           { question, answer }      // interview-flavoured posts
```

Indicative availability (to confirm against the A/B/C mockups):
- **Post · Classic** — paragraph, heading, pull-quote, inline/wide image.
- **Post · Split** — paragraph, heading, pull-quote, image (split treatment).
- **Post · Photo-essay** — full-bleed image, image-pair, gallery, sparse paragraph.
- **Albums — no blocks at all.** An album is `images[]` + `intro` + a **style**
  picked once ("set and forget"). The style alone decides presentation (essay
  flow vs sticky-scroll vs contact-sheet grid). No block composition.

---

## 5. The editor (two-pane authoring screen)

Two editors of different weight:

- **Album editor — simple (set-and-forget).** A plain form: meta fields (title,
  date, category, intro) + an image uploader (reorder, captions, pick cover) + a
  **style dropdown** (Essay / Sticky / Contact-sheet) + a **placement** control
  (Blog / Gallery / Both, default Gallery). No block palette. Optional live
  preview.
- **Post editor — block composer.** The two-pane screen below.

### Post editor

- **Left — form:**
  - Meta fields (title, author, date, cover, tags) + a **style dropdown** + a
    **placement** control (Blog / Gallery / Both, default Blog).
  - Body = a stack of block cards, each a small form (textarea, image picker,
    caption). **“+ Add block”** palette *filtered by the selected style*. Drag to
    reorder.
- **Right — live preview** rendered with the **exact same components as the live
  site**. What they build is what ships.

No canvas, no drawing, no AI. "Add a pull-quote, type it, pick an image."

---

## 6. Storage — two routes

Both dependency sets are already installed, so this is a real choice.

- **Route A — Git/file CMS over @nuxt/content.** Posts as markdown + MDC blocks
  (`::pull-quote`, `::full-bleed-image`); edit via Nuxt Studio or TinaCMS.
  _Least code_, but editing is tied to the repo/Git — awkward for a non-technical
  officer.
- **Route B — Custom DB admin (NuxtHub + nuxt-auth-utils + SQLite).** Auth-gated
  `/admin`, the block editor above, posts stored as JSON/rows, pages render from
  the DB. _More to build_, but it's a true "log into the live site and publish"
  experience — what a rotating committee needs.

**Recommendation: Route B is the end-state** (the installed deps already point
there; non-devs won't use Git). BUT the important, storage-agnostic decision is
the **block schema + A/B/C templates** — nail those first; storage can start on
files and migrate to DB without changing the templates.

---

## 7. Build order (design-first)

1. **Lock A/B/C** for posts and albums (visual sign-off on the mockups).
2. **Define the block set** per style (the `z.enum`s + which blocks each allows).
3. **Design the editor screen** (two-pane form + live preview) as a mockup.
4. **Port styles to components** — render templates driven by `style` + `body[]`.
   (Reuse on the live site AND in the editor preview — one source of truth.)
5. **Build the admin, DB-backed** — auth, CRUD, image upload (NuxtHub blob),
   publish/draft.

Steps 1–3 are design/spec (no premature code), matching the project workflow.

---

## 8. Decisions

**Locked**
- Sections: Home = merged latest · Blog = posts only · Gallery = albums only.
- No newsletter (for now).
- Album vs post boundary: album = collection (Gallery); post = authored piece
  (Blog), photo-essays included. Intent + authorship, not image count.
- Posts and albums each have three approved styles (A/B/C mockups above).
- **Albums are fixed-style, set-and-forget — no block authoring.** Pick one of
  three styles per album; the block composer is **posts-only**.
- **Placement is the admin's editable final say** over index visibility
  (`blog` / `gallery` / `both`), defaulting from type, changeable anytime.
  Affects which section lists an item; never affects rendering or the Home feed.

**Still open**
- Confirm the friendly name + block availability for each post/album style.
- Whether the *feed/index card* varies by style or stays uniform (lean: uniform).
- Featured post on the Blog index: pin it (outside the filter) vs filterable
  (lean: pin).
- Storage route final call (lean: B, DB-backed) and when to migrate off files.

**Out of scope (now):** newsletter; any freeform/page-builder editing.
