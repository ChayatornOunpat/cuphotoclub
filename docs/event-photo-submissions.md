# Event Photo Submissions

Let participants upload photos from an occasion with or without their name attached. Admins
open a **photo collection**, share a link, and collect what comes in.

**Collections are standalone.** A collection is its own thing in the dashboard — no foreign
key into events/activities, nothing created or managed from an activity page. An event often
*has* a collection, but that relationship lives in the admin's head, not in the schema. This
keeps the two lifecycles independent: activities have dates, venues and publication states
that a photo link neither needs nor wants.

**Everything lands in an admin-only pool.** There is no review queue and no accept/reject
step — a pool that is never public has nothing to moderate *for*. The only editorial decision
is consolidation: an admin or editor picks the keepers out of the pool and turns them into a
content album under `/albums`, downloads a few for Instagram or Facebook, and leaves the rest
where they are. Junk gets deleted whenever someone notices it, the same as any other cleanup.

```
participant uploads  ->  admin-only pool  --.
                                             |-- consolidate -> content album (§8)
                                             |-- download    -> IG / Facebook
                                             |-- delete      -> R2 trash (restorable)
                                             `-- sits in the pool indefinitely
```

Contributors can edit and remove their own photos for as long as the link is open, from any
device, via a claim code (§2). When the club has what it needs, it closes the link and that
window shuts (§7).

This reuses the existing direct-R2 upload pipeline (see `r2-direct-upload.md`) rather than
building a second one.

---

## 1. What already exists, and what it costs us

| Piece | Where | Reusable as-is? |
|---|---|---|
| Compress → hash → presign → PUT → complete state machine | `app/components/admin/R2ImageUploader.vue` | Yes, with five new props |
| Manifest + presign + complete endpoints | `server/api/admin/upload/sessions/**` | No — all three call `requireAdmin()` |
| `upload_sessions` / `upload_session_items` tables | `server/db/schema.ts` | Yes, with a nullable `actor_id` |
| Key derivation, sanitizers, size cap | `server/utils/uploadKeys.ts` | Yes |
| SigV4 presigning | `server/utils/r2Presign.ts` | Yes |
| R2 delete reference counting | `server/utils/r2Delete.ts` | Yes, must be extended |
| Trash / restore | `server/utils/r2Trash.ts` | Yes |
| KV rate limiter | `server/utils/ratelimit.ts` | Yes, but see §11 |

Four properties of the existing system drive most of the design below:

1. **`/images/<r2Key>` is unauthenticated.** `server/routes/images/[...pathname].get.ts`
   serves any object in the bucket to anyone who has the key. There is no per-object ACL.
2. **Keys are content-addressed.** `hashedUploadKey()` gives `<prefix>/<sha256>.<ext>`, so
   the same file uploaded by two different people lands on *one* R2 object.
3. **The client picks the prefix.** `sanitizeUploadPrefix()` only strips unsafe characters;
   it does not constrain *where* in the bucket you write.
4. **Uploads are admin-identified.** `upload_sessions.actor_id` is `integer NOT NULL` and
   every endpoint asserts `session.actorId === actor.id`.

---

## 2. Session model

**No accounts, no OAuth, no email.** Contributors are identified by a cookie for convenience
and by a **claim code** for portability. Nothing else.

### The two halves

**Cookie — the convenience half.** On first visit to `/contribute/<token>` the server creates
a contributor row and puts its id in its own signed, httpOnly cookie:
`useSession(event, { name: 'cu_contrib', password: ... })`. Deliberately *not* the
nuxt-auth-utils user session.

Why a separate cookie: `requireAdmin()` rejects a session without `id`/`email`/`role`, but
plain `requireUserSession()` would accept one. Putting contributors into the auth-utils
`User` session makes every present and future `requireUserSession()` call site a place a
participant might slip through. Two trust boundaries, two cookies, so that class of bug
cannot be written.

**Claim code — the portability half.** Along with the row, the server mints a code and shows
it on the page immediately, before the first upload finishes:

```
CUPC-7K2PQ-9XW4M
```

Typing that code on any other device adopts the same contributor identity. That is the whole
cross-device story: phone uploads in the morning, laptop edits in the evening, same list.

### Code design

- **Alphabet: Crockford base32** (`0123456789ABCDEFGHJKMNPQRSTVWXYZ` — no I, L, O, or U).
  People will read this off a laptop and thumb it into a phone; ambiguous glyphs are the
  entire failure mode. Normalize on input: uppercase, strip dashes and spaces, and map
  `I`/`L` to `1` and `O` to `0` so a mistyped code still resolves.
- **Length: 10 characters = 50 bits.** Formatted `CUPC-XXXXX-XXXXX`. Short enough to type,
  far past guessable when the redeem endpoint is rate-limited.
- **Stored hashed, not plaintext.** The code is a bearer credential — anyone holding it can
  edit and delete that contributor's photos. The DB stores a SHA-256; the redeem endpoint
  hashes and looks up.
- **But the plaintext also lives in the contributor's own cookie session.** That way the page
  can keep re-displaying the code to the person who owns it ("I forgot to write it down, but
  I am still on the same phone") without the server ever storing a plaintext bearer token.
  Once their cookie is gone, only the code itself recovers them.
- **Scoped to one link, expiring with it.** A code is for one event's collection, not a
  permanent account. Bounded lifetime, bounded blast radius, and nothing long-lived to leak.
  Scoping globally instead would give repeat contributors a single code across events — nicer
  for them, a longer-lived credential for us. Per-link is the safer default.

### Redeeming is a guessing oracle — rate limit it

`POST /api/contribute/[token]/claim` must be capped per IP, or it is a brute-force target.
Ten attempts per hour per IP is plenty for real use.

This one is safe to put on KV despite §11, because `rateLimit()` **does not write when it is
already over the limit** — it returns `false` from the `rl.count >= max` branch before
reaching `kv.set()`. So an attacker from one IP costs at most `max` writes per window. Keep
`max` low and that stays true.

### What a code can and cannot do

It can list, edit, and remove that one contributor's own photos, under one link, while that
link is open (§7). That is the entire blast radius: it cannot see other contributors, cannot
reach any admin surface, and stops working the moment the admin closes the link. Losing a code
is not a security event — that person just manages nothing further, and an admin handles any
later removal by hand.

### Anonymous is still the default

Signing in is not a thing here, so anonymity is unchanged: `displayName` stays nullable and
"post me as Anonymous" is a checkbox. Everyone gets a code whether or not they type a name —
it costs nothing to mint, and the page simply does not nag people who clearly want to dump
photos and leave.

---

## 3. Data model

Three new tables. **None of them references `events`** — see the intro: a collection is
standalone, identified by its own token and label.

**Why the pool is its own table rather than a draft legacy gallery.** The legacy
`albums` + `photos` tables look tempting — `photos.photographer` already exists for
attribution, `/admin/galleries/[id]` already has a working PhotoManager, and the public
`/galleries` pages were deleted. But they are *not* admin-only:
`server/api/albums/[slug].get.ts` and `server/api/home.get.ts` both read that table, gated
only on `status = 'published'`. Staging raw participant submissions there puts the whole pool
one mis-clicked toggle away from the front page.

`collection_submissions` has no public read route at all. That is a structural guarantee rather
than a flag someone has to remember, which is the right trade for content we do not control.
Publishing then writes *out* of the pool into whichever real surface the admin picks, leaving
every public read path exactly as it is today — no new query on any hot page.

```ts
export const collectionLinks = sqliteTable('collection_links', {
  id: text('id').primaryKey(),             // url-safe random token, ~22 chars
  label: text('label'),                    // free-form; shown on the contribute page
  status: text('status', { enum: ['open', 'closed'] }).notNull().default('open'),
  passcodeHash: text('passcode_hash'),     // optional second factor on the link
  requireName: integer('require_name', { mode: 'boolean' }).notNull().default(false),

  // Per-link limits the admin sets when opening collection (§10).
  maxPerContributor: integer('max_per_contributor').notNull().default(100),
  maxTotal: integer('max_total').notNull().default(2000),

  // Client-side compression policy, sent to the uploader as props. Stored as
  // real numbers rather than a preset enum so the admin UI can offer presets
  // *and* let someone nudge one value without a schema change.
  compress: integer('compress', { mode: 'boolean' }).notNull().default(true),
  compressMaxDim: integer('compress_max_dim').notNull().default(3040),
  compressQuality: integer('compress_quality').notNull().default(90), // percent
  // The server-enforced half of the compression policy (§10). Capped by
  // MAX_UPLOAD_BYTES, which no link may exceed.
  maxBytesPerPhoto: integer('max_bytes_per_photo').notNull().default(15 * 1024 * 1024),

  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdBy: integer('created_by').references(() => users.id),
  createdAt, updatedAt
})

export const collectionContributors = sqliteTable('collection_contributors', {
  id: text('id').primaryKey(),              // uuid; what the cookie holds
  linkId: text('link_id').notNull().references(() => eventUploadLinks.id, { onDelete: 'cascade' }),
  // SHA-256 of the Crockford-base32 claim code. Never the plaintext — the
  // plaintext lives only in this person's own sealed cu_contrib cookie.
  codeHash: text('code_hash').notNull(),
  displayName: text('display_name'),        // null = anonymous
  contact: text('contact'),                 // admin-only, optional
  createdAt,
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' })
}, table => [
  // Redeem looks up by hash alone; scoping the uniqueness to the link keeps two
  // collections from ever colliding on one code.
  unique('collection_contributors_link_code_unq').on(table.linkId, table.codeHash),
  index('collection_contributors_code_idx').on(table.codeHash)
])

export const collectionSubmissions = sqliteTable('collection_submissions', {
  id: text('id').primaryKey(),              // uuid
  linkId: text('link_id').notNull().references(() => collectionLinks.id, { onDelete: 'cascade' }),
  contributorId: text('contributor_id').notNull()
    .references(() => eventContributors.id, { onDelete: 'cascade' }),
  caption: text('caption'),                 // contributor-editable while the link is open
  r2Key: text('r2_key').notNull(),
  hash: text('hash').notNull(),
  size: integer('size').notNull().default(0),
  type: text('type').notNull(),
  // No review status. A row in this table *is* a photo in the pool; deleting the
  // row is how junk leaves. The only state a submission carries is whether it has
  // been used yet: null = still only in the pool, otherwise the surface it went
  // to — 'album:<id>', 'event:<id>', or 'external' for an IG/Facebook download.
  publishedTo: text('published_to'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt
}, table => [
  index('collection_submissions_link_idx').on(table.linkId),
  index('collection_submissions_contributor_idx').on(table.contributorId),
  index('collection_submissions_key_idx').on(table.r2Key)
])
```

**There is no `status` column, and that is the simplification.** An accept/reject stage would
only move a flag between two states that look identical to the outside world, since neither is
public. Deleting a junk photo goes through `addToR2Trash()`, which is already restorable — the
trash *is* the undo that a `rejected` state would have provided, and it is code that already
exists.

`publishedTo` is not a status either; it is a record of where a photo has been used. One photo
can go into an album and also be downloaded for Instagram, so treat the last write as
informational rather than as a state machine.

Attribution lives on `collection_contributors`, not on each row — one person editing their name
should re-credit their whole batch, not require 40 edits. `caption` stays per photo because
that genuinely varies.

`collection_submissions` has 11 columns, so **batch inserts cap at `floor(100 / 11) = 9` rows per
statement** under D1's 100-bound-parameter limit — the same constraint already handled in
`uploadSession.ts`.

And one migration on the existing table: `upload_sessions.actor_id` stays NOT NULL (contribution
sessions store 0, which no autoincrement user id can ever be) plus `contributor_id text` and
`kind text not null default 'admin'`. Keeping the constraint avoids a SQLite table rebuild,
whose generated SQL wraps a DROP TABLE in `PRAGMA foreign_keys=OFF`.

---

## 4. API surface

Parallel routes, shared utils — *not* a mode flag on the admin endpoints.

```
POST   /api/contribute/[token]/sessions                              <- manifest
POST   /api/contribute/[token]/sessions/[id]/items/[itemId]/presign
POST   /api/contribute/[token]/sessions/[id]/items/[itemId]/complete
GET    /api/contribute/[token]                  -> link state (open? name required? caps)
POST   /api/contribute/[token]/claim            -> redeem a code on a new device
GET    /api/contribute/[token]/me               -> my identity + my claim code (if cookie holds it)
PATCH  /api/contribute/[token]/me               -> change display name / anonymous / contact
GET    /api/contribute/[token]/mine             -> my submissions
PATCH  /api/contribute/[token]/mine/[id]        -> edit caption
DELETE /api/contribute/[token]/mine/[id]        -> remove, while unpublished
```

The three upload endpoints are near-copies of the admin trio with `requireAdmin()` swapped
for `requireContributor(event, token)` and `session.actorId` swapped for
`session.contributorId`. That is deliberate duplication: the alternative — adding a `kind`
branch inside the admin handlers — puts the entire security boundary inside a diff where one
missed `if` lets a participant presign into `covers/`. Two ~60-line files you can read at a
glance are worth more than the deduplication.

Everything expensive stays shared: `hashedUploadKey`, `sanitizeUpload*`, `MAX_UPLOAD_BYTES`,
`createR2PresignedPutUrl`, `getUploadSession` / `saveUploadSession`, and the whole client
component.

**The prefix must be computed server-side.** The contribution endpoints ignore any
client-supplied prefix entirely:

```ts
const prefix = `contributions/${link.id}`
```

Otherwise a participant writes into `covers/` or `content-albums/...` and pollutes the admin
media browser. Content-hash keys mean they cannot *overwrite* anything, but they can litter.

Admin side:

```
POST   /api/admin/upload-links                      -> create
PATCH  /api/admin/upload-links/[linkId]             -> open/close, expiry, caps
GET    /api/admin/upload-links                      -> all links + counts

GET    /api/admin/submissions?linkId=&used=         -> the pool, paginated
POST   /api/admin/submissions/consolidate           -> { ids: [], albumId? }
DELETE /api/admin/submissions                       -> { ids: [] }  to R2 trash
GET    /api/admin/submissions/[id]/download         -> original, attachment
```

Link management and the pool both live on `/admin/submissions` in the dashboard — the pool
page is the home of the whole submissions workflow. Nothing appears under an activity page.

Three verbs, no review stage. `consolidate` is the one that matters (§8): it copies the chosen
objects into a content album and stamps `publishedTo` / `publishedAt`. `DELETE` routes through
`addToR2Trash()` so it stays restorable. Both call `recordAdminAudit()`, matching every other
mutation in the codebase — the audit log is also where "who consolidated this" lives, which is
why no `publishedBy` column exists.

`download` serves the original with `Content-Disposition: attachment` for the
Instagram/Facebook path and marks `publishedTo = 'external'`, so the pool can show at a glance
what has already been used. It is per-photo: a streaming zip of a whole event is possible in a
Worker but is real work, so bulk export is a follow-up, not v1.

The `used=` filter is the whole triage story — "show me what I have not done anything with
yet" replaces what a pending queue would have been.

---

## 5. Reusing R2ImageUploader

`R2ImageUploader.vue` is 1,100 lines carrying browser-side compression, SHA-256 hashing,
concurrency control, the Error-1102 backoff-and-resume logic, `sessionStorage` resume
signatures, and 250-file session chunking. Rewriting any of that for the public page would
be a mistake.

Five new props, all defaulting to today's behaviour so nothing about the admin uploader
changes:

```ts
endpointBase?: string          // default '/api/admin/upload/sessions'
compress?: boolean             // default true   (today: autoCompress ref)
compressMaxDim?: number        // default 3040   (today: COMPRESS_MAX_DIM)
compressQuality?: number       // default 90     (today: COMPRESS_QUALITY * 100)
showCompressControl?: boolean  // default true   (contribute page passes false)
```

`endpointBase` feeds the `$fetch` call sites in `createUploadSessionBatch()` and
`uploadPreparedFileDirect()`; the contribute page passes
`/api/contribute/${token}/sessions`. The three compression props replace the module-level
`COMPRESS_MAX_DIM` / `COMPRESS_QUALITY` constants and seed the existing `autoCompress` ref.

The compression UI already exists — the on/off toggle and the `uploader.compressOn` string
that interpolates `{dim}` and `{quality}` are in the template today, so configurable values
flow into the existing copy with no new i18n keys. `showCompressControl: false` hides that
toggle on the contribute page — compression is an admin decision, and a participant should
never see a knob for it.

### The contribute page is a dropzone, not a form

The participant experience should read like dropping files into Google Drive. Drop photos,
watch them upload, see them appear. That is the page.

Everything else is chrome around the edges:

- **No settings at all.** No compression toggle, no quality picker, no advanced section. The
  admin already decided every one of those on the link.
- **The name field is one optional input**, not a registration step. Empty means anonymous,
  and the page does not nag.
- **The claim code is a quiet strip**, never a modal or a gate — "opening this on another
  device? use `CUPC-7K2PQ-9XW4M`", with a copy button. It must not stand between someone and
  their first upload.
- **Uploading starts on drop.** No "review your selection" stage, no submit button at the
  bottom of a wizard.
- **Their photos appear in a grid underneath**, each with a remove control. That grid *is* the
  confirmation that it worked.

`R2ImageUploader` already carries the parts that make this feel solid on a phone at an event:
queueing files dropped mid-upload, `sessionStorage` resume signatures, the Error-1102 backoff,
and a `beforeunload` warning. Reusing it is most of the work.

The one thing that must surface to the participant is the cap — as feedback, never as a
control. A quiet "34 of 100" beside the dropzone, and a clear message when it is reached.
Silently failing at photo 101 is the one way this page can feel broken.

Two follow-ups on the component:

- `signatureStorageKey()` keys `sessionStorage` on `props.prefix`; the contribute page does
  not pass a prefix (the server decides), so key it on `endpointBase` instead or the resume
  cache collides between events.
- It lives in `app/components/admin/`, which CLAUDE.md scopes to scoped-CSS-not-Tailwind.
  Using it on a public page is fine — the *wrapper* page follows public-page conventions.

**R2 CORS already allows the needed origins and headers** (`config/r2-cors.json`:
`PUT`/`DELETE`, `content-type`, `x-amz-meta-hash`, `x-amz-meta-seq`). No bucket change.

---

## 6. Submitted photos are publicly fetchable — gate them

Because `/images/<key>` is ungated, an object is readable the instant it lands, before any
admin sees it. Keys are SHA-256 so they are unguessable and only the uploader and admins hold
them — but with an admin-only pool as the destination, "not public yet" has to mean something
technical, not just socially.

The gate covers the **entire pool**, with no exceptions — there is no reviewed-and-blessed
subset that gets treated differently, because there is no review stage. Only consolidation
makes a photo publicly fetchable, and it does so by creating a new object elsewhere.

Because publishing copies objects out of `contributions/` (§8), the gate can be a single
prefix rule instead of a lookup:

```
/images/contributions/**   ->  404, always
```

That is a string comparison in `server/routes/images/[...pathname].get.ts` with no DB call,
no per-request state, and no interaction with the `Cache-Control:
public, max-age=31536000, immutable` that both the handler and the `'/images/**'` routeRule
put on that path. Nothing under the prefix is ever legitimately public, so there is no case
where the edge cache can have poisoned a URL that later needs to work.

This is the piece that makes "gated" mean something technical. An auth *branch* on that route
— serve if admin, 404 otherwise — would be the wrong shape: it fights an immutable edge cache
that may already have handed the object out.

Unpublished photos are then served only from routes that were never cached:

```
GET /api/contribute/[token]/preview/[submissionId]   -> contributor's own
GET /api/admin/submissions/[id]/preview              -> admin pool browsing
GET /api/admin/submissions/[id]/download             -> original as attachment
```

All stream via `blob.serve()` with `Cache-Control: private, no-store`. A key never becomes
publicly servable in place — publish creates a *new* object outside `contributions/`, and it
is that copy which `/images/` serves under the immutable cache.

One consequence worth planning for: the admin pool view renders every thumbnail through an
uncached Worker route, so a 500-photo event is 500 uncached image requests per page view.
Paginate the pool hard (or use `/cdn-cgi/image/` width-limited thumbs — but note that transform
quota is 5k/month on the free plan and the project rule is to keep transforms on bounded
surfaces only, which a pool grid is not). Pagination is the safe answer.

---

## 7. What contributors can change, and until when

**One rule: the link is the window.** While an event's link is open, a contributor can edit
captions, change their credit, and remove any of their own photos. When an admin closes the
link, contributor editing ends. There is no per-photo permission matrix.

This is deliberately blunt, and it works because of the copy-on-publish step in §8: once a
photo is consolidated into an album, the album holds its *own* R2 object under
`content-albums/<albumId>/`. A contributor deleting their submission after that removes the
submission and the pool copy — the published album is untouched, because it is no longer
pointing at the same key. Nothing dangles, so nothing needs blocking.

Closing a link should leave the page reachable and read-only rather than dead: a contributor
who opens their old link sees what they submitted and a "collection closed" note. That is one
extra branch and it avoids the "where did my photos go" message.

**Instagram and Facebook are explicitly out of scope.** Once an admin has exported a photo and
posted it, nothing here retracts it, and the design does not pretend otherwise — the answer is
that the club closes the link once it has what it needs, and anything after that is a
conversation between two people, not a feature.

---

## 8. Consolidating a pool into an album

The end state for a good event: an admin or editor picks the keepers out of the pool and
turns them into a content album under `/albums`. This is the primary publish target — the
event gallery (`events.gallery_r2_keys`) stays available as the cheap option, but the album
is the one worth designing for.

Access is `requireAdmin()`, not `requireManageUsers()` — per CLAUDE.md, content management is
open to editors.

### Publishing copies the object, and that is the point

Content albums keep their media in `content-albums/<albumId>/`, which
`server/api/admin/albums/draft.post.ts` calls the album's permanent home. Submissions live in
`contributions/<linkId>/<contributorId>/`. Consolidation therefore copies the selected objects into
the album folder and points the album cells at the new keys.

Referencing the submission keys in place would also work mechanically —
`getR2DeleteReferences()` scans editorial album cells by `cell.src` regardless of prefix, and
the `content-albums/<id>/` folder check in `r2-images.get.ts` is display-only and explicitly
"never blocks deletion". But copying buys three things at once:

1. **It makes the §6 gate real.** If nothing published ever lives under `contributions/`, then
   `/images/` can hard-404 that entire prefix with a string comparison — no per-request DB
   lookup on a hot, immutable-cached route.
2. **It decouples contributor deletion from published content** (§7), which is what lets the
   permission model collapse to "the link is the window".
3. **It matches the album-first invariant** the rest of the codebase already assumes.

The cost is one copy per *published* photo — the curated handful, not the whole pool.

### Copy without streaming through the Worker

The NuxtHub blob API has `get` / `getArrayBuffer` / `put` / `head` / `list` / `delete` and
**no `copy`**. So the obvious implementation is `getArrayBuffer()` then `put()` — which pulls
every byte of a 15MB image into Worker memory and back out. Do a batch of thirty and that is
the same CPU/resource ceiling that produced the Error 1102 incidents this codebase already
carries scar tissue for.

Use R2's S3 `PUT` with an `x-amz-copy-source` header instead: the copy happens inside R2 and
no bytes cross the Worker. `server/utils/r2Presign.ts` already implements SigV4 for this
bucket, so this is a second signer beside `createR2PresignedPutUrl()`, not new cryptography.

Treat `getArrayBuffer` + `put` as the fallback only if the signed copy proves troublesome, and
if so, cap the batch size hard.

### What consolidation writes

- create a draft content album (or pick an existing one) via the album-first flow
- copy each chosen object to `content-albums/<albumId>/<hash>.<ext>`
- lay the images into `rows` / `cells` — the existing album canvas already does this
- carry the contributor's `displayName` into the album's credits
- stamp `publishedTo = 'album:<albumId>'` and `publishedAt` on each submission
- `recordAdminAudit()` for the batch

---

## 9. Deletion safety

Content-addressed keys mean two submitters uploading the same photo share one R2 object.
Deleting one submission must not delete an object the other still needs — and with no review
stage, this is now the *only* thing standing between a cleanup click and someone else's photo.

`server/utils/r2Delete.ts` already solves exactly this with `getR2DeleteReferences()` /
`isR2DeleteReferenced()`, which scans photos, posts, events, members, hero, history,
clubroom, and editorial albums. **Add a `submission: boolean` field to
`R2DeleteReferenceInfo`** plus a lookup for any surviving `collection_submissions` row on that key.
The check is simply "does a row still point here", which is as simple as it is because the
status column is gone.

This is not optional. The pool is a blind spot for the existing scan: a submission sitting in
it is referenced by *nothing* the eight current sources know about, so without this an admin
tidying `/admin/r2-images` deletes the object out from under it and the pool shows broken
tiles.

Deletes route through `addToR2Trash()` rather than `blob.delete()`, matching how every other
destructive path in the app behaves — and doubling as the undo that a `rejected` state would
otherwise have provided.

---

## 10. Admin-configurable limits

Everything here lives on the link row (§3), so it is set per event when collection opens and
can be changed while it runs.

### Per-participant cap

`maxPerContributor`, default 100. Enforced in **two** places, for different reasons:

- **At manifest creation** — reject the batch with a friendly count: "you can upload 12 more".
  This is the useful error, since it fires before the browser spends minutes compressing.
- **At `complete`** — the authoritative gate that refuses to insert row 101.

Both are needed because rows are only created at `complete`, so a manifest check alone can be
raced by opening several sessions. The manifest check is UX; the `complete` check is the rule.

Two details that decide whether the count means what an admin thinks it means:

- **Deduplicate by hash within a contributor.** The same photo submitted twice is one R2
  object; it should be one submission and count once, not two. Without this, a participant
  who re-drags the same folder appears to blow through their cap.
- **A count cap is not a storage cap.** 100 × 15MB is 1.5GB from one person. With compression
  at 3040px/90 a typical phone photo lands near 1–2MB, so 100 is really ~150MB — but that only
  holds while compression is on, and compression is a client-side request, not a guarantee
  (below). If R2 spend is the actual worry, add a `maxBytesPerContributor` alongside the count;
  the `complete` handler already knows each object's real size from `blob.list()`.

`maxTotal` works the same way at link scope and stops one link from filling the bucket.

### Compression policy

`compress` / `compressMaxDim` / `compressQuality` on the link, passed to the uploader as props
(§5). The admin UI should offer presets rather than a raw quality number — nobody should have
to reason about 0.82 versus 0.90:

| Preset | maxDim | quality | Typical phone photo |
|---|---|---|---|
| Original | — | off | 4–12 MB |
| High | 4096 | 92 | ~2–3 MB |
| Balanced *(default)* | 3040 | 90 | ~1–2 MB |
| Small | 2048 | 80 | ~400–700 KB |

Balanced is today's hard-coded behaviour, so an existing-feeling default costs nothing.

**The contributor gets no say.** `showCompressControl: false` on the contribute page (§5). The
admin sets the policy; the participant drops files. There is no override, in either direction.

### Why compress in the browser at all

Because for the album wall it is the *only* compression that ever happens. The project rule
keeps `/cdn-cgi/image/` transforms on bounded surfaces (hero, covers, cards) and off album
walls and the flip-grid — 8k images against a 5k/month free quota does not work. So on those
pages the bytes in R2 are exactly the bytes a visitor downloads, and there is no later
opportunity to shrink them.

Rough scale for a 400-photo event:

| Policy | Per photo | Event total | 30-image wall view |
|---|---|---|---|
| Original | ~6 MB | ~2.4 GB | ~180 MB |
| Balanced | ~1.5 MB | ~600 MB | ~45 MB |
| Small | ~0.5 MB | ~200 MB | ~15 MB |

R2's free tier is 10 GB, so uncompressed events fill it in about four. Doing the work in the
browser also puts the CPU on the participant's phone rather than the Worker, which matters
given the Error-1102 history. Server-side re-encoding was never a real option: Workers cannot
decode JPEG without a library, and Cloudflare Images is the same quota being avoided.

Losing the original is **not** a concern here: admin uploads to albums already go through the
same `compressImage()`, and the club keeps originals in Google Photos. R2 has never been the
archive. So the only question about compression is whether the encode itself is good.

### The encode is fine, but it is not as good as it could be

Nothing proposed here changes the encoder — the props default to today's 3040 / 90, so the
admin path is byte-for-byte identical. But since the code is being touched anyway, three
things would make it genuinely better than what the album editor does today:

1. **Quality 90 is higher than it needs to be.** JPEG at 82–85 is usually indistinguishable
   from 90 at normal viewing distance and lands 30–40% smaller. This is the single cheapest
   win: one constant.
2. ~~**WebP beats JPEG by roughly another 30%**~~ — **done**, ahead of this feature.
   `compressImage()` now encodes WebP when the browser can, falling back to JPEG otherwise,
   so anything uploaded through the contribute page inherits it for free.
3. **Encode to a target size, not a fixed quality.** Today's fixed quality means output size
   swings wildly with subject matter — a busy crowd shot at q90 can be 4MB while a plain wall
   is 400KB. Re-encoding at stepped-down quality until the result fits a byte target gives
   predictable sizes and pairs exactly with the server-enforced `maxBytesPerPhoto` below: the
   client can then essentially never produce a file the server will reject.

(1) and (2) together are plausibly half the bytes at the same apparent quality. (3) is what
makes the admin's byte limit a promise rather than a tripwire.

### Two things the participant flow will hit that the admin flow has not

The album editor is a few people on desktops uploading curated exports. The contribute page is
many people on phones uploading straight from a camera roll, so failure modes that never
surfaced will:

- **HEIC.** iPhones shoot HEIC by default. `type.startsWith('image/')` passes it, but
  `createImageBitmap()` cannot decode HEIC outside Safari, so `compressImage()` throws. iOS
  usually transcodes to JPEG when a file is picked through `<input type="file">`, which is
  probably why this has never bitten — but a HEIC arriving from a Mac Finder drag or some
  Android file managers would. Needs an explicit, friendly failure at minimum.
- **EXIF orientation.** `createImageBitmap(file)` is called with no `imageOrientation` option,
  and canvas output carries no EXIF, so a portrait photo that relies on an orientation flag
  could come out sideways. 139 albums have gone through this path without complaint, so it is
  very likely fine — but it is worth one deliberate test with a portrait phone photo before
  pointing a hundred participants at it.

**EXIF dates are already handled correctly.** Canvas re-encoding strips metadata, but
`upload()` reads capture dates from the originals *before* compression
(`detectExifRange(photos)`, with a comment saying exactly that), so album date ranges survive.
Camera and lens metadata does not — capturing that would have to happen at the same point.

### Making the policy actually enforceable

Compression itself runs in the browser, so a modified client can ignore every prop above. That
would make the admin's setting a suggestion — which is not what an admin-side control should
be. So pair it with a limit the **server** owns:

```ts
maxBytesPerPhoto: integer('max_bytes_per_photo').notNull().default(15 * 1024 * 1024)
```

Enforced in the contribution `presign` and `complete` handlers exactly where `MAX_UPLOAD_BYTES`
is checked today — `complete` re-reads the real object size from `blob.list()`, so it catches a
client that lied in the manifest. `MAX_UPLOAD_BYTES` stays the hard ceiling no link can exceed.

That inverts the relationship in a useful way: **the byte limit is the rule, and compression is
how a well-behaved browser meets it.** An admin who picks "Small" and 1MB gets a guarantee, not
a hope. The client should also check the post-compression size locally and tell the person
which file is too big *before* uploading it, rather than letting the server reject it after a
slow mobile upload.

**Two remaining honest limits:**

1. **The policy changes the R2 key.** `createUploadSessionBatch()` hashes the *compressed*
   file, so the same source photo produces a different key under a different policy. Changing
   the setting mid-event means two people who upload the same photo either side of the change
   no longer deduplicate onto one object. Harmless, but it explains an otherwise confusing
   duplicate.
2. **Compression converts to JPEG.** `compressImage()` always emits `image/jpeg` and renames
   the file to `.jpg`, so a PNG with transparency loses it. Fine for event photography, worth
   an admin-facing note next to the "Original" preset — and note that "Original" plus a tight
   `maxBytesPerPhoto` is a contradiction that the admin UI should refuse to save.

### Everything else

Token + `expiresAt` + the close switch. For a club event that is probably enough. Turnstile on
the form is available if we want it (the `turnstile-spin` skill automates the setup) but adds
a dependency — treat it as a later hardening step rather than v1.

---

## 11. The KV write-quota trap

This deserves its own section because it has taken the site down before: the CACHE KV
namespace hit the free plan's 1,000-writes/day ceiling and every public page 500'd.

`rateLimit()` performs **a KV write on every call**, including allowed ones. If the
contribution endpoints rate-limit per file, one participant submitting 200 photos costs 200
KV writes, and a handful of participants take the whole site down.

So:

- rate-limit **only** at manifest-create — one write per batch of up to 250 files
- enforce per-file and per-person caps with `count(*)` against `collection_submissions`, which is
  storage the feature needs anyway
- never call `rateLimit()` inside presign or complete

---

## 12. Routing, caching, i18n

- The public page is `/contribute/[token]`, and it must stay **out of any `swr` routeRule**.
  Nothing matches `/contribute/**` today, so the default (uncached) applies — the trap would
  be nesting it under `/activities/**`, which *is* `swr: 120`, and serving one contributor's
  cached page to the next.
- `definePageMeta({ layout: 'site' })` or the page renders with no nav, footer, or styling.
- Public page uses the public-page conventions; any admin panel uses scoped CSS + BEM per
  CLAUDE.md.
- Every string goes through `t()` with keys added to **both** `en.json` and `th.json`.

---

## 13. Build order

1. Migration: three tables, plus `upload_sessions` `kind` + `contributor_id`.
2. `server/utils/contribution.ts` — link tokens, claim-code mint/normalize/hash,
   `requireContributor()`, cap checks.
3. Contribute endpoints: link state, claim, me, manifest, presign, complete.
4. `endpointBase` prop on `R2ImageUploader` + the `sessionStorage` key fix.
5. `/contribute/[token]` page: name field, uploader, the code panel, "my uploads" with
   edit + remove, and the "I have a code" entry path.
6. Reference counting: `submission` field in `r2Delete.ts`.
7. Preview + download routes (contributor + admin), `private, no-store`.
8. Admin: collection panel on `/admin/submissions` — create link, copy URL, **close**,
   set the per-participant cap and the compression preset (§10).
9. Admin: the pool view — paginated grid, `linkId=`/`used=` filters, per-photo download,
   delete.
10. Signed R2 copy in `r2Presign.ts`, then select-and-consolidate into a content album.
11. i18n keys, both locales.

Steps 1–5 are a working end-to-end vertical slice. Step 6 must land before 9 ships, and 7
must land *with* 9 — an ungated pool view is the thing this design exists to avoid.

Dropping the review stage means 9 is genuinely usable before 10 exists: a browsable, gated
pool with download and delete already covers the Instagram path end to end, and consolidation
into an album can follow.

The claim code is **not** a step to defer. It is the only thing that makes editing work across
devices, so it belongs in the same slice as the upload path — bolting it on later means
migrating contributor rows that were minted without one.

---

## 14. Decisions

**Settled:**

- **Collections are standalone** — no foreign key into events/activities, no link management
  on activity pages. An event often *has* a collection, but that is a human association; the
  schema and the admin UI keep the two systems independent.
- Accepted photos go to an **admin-only pool**, not straight to a public surface. Publishing
  is a second, explicit decision, and downloading for Instagram/Facebook is a first-class
  path alongside it.
- The pool is its own table, **not** a draft legacy gallery — see §3 for why that table is one
  toggle away from public.
- **Nothing under `contributions/` is ever publicly servable.** `/images/` 404s that prefix
  outright, which works precisely because publishing copies the object elsewhere (§6, §8).
- **No accounts, no OAuth, no email.** Identity is a cookie plus a **claim code**, and the
  code ships in v1 because it is what makes cross-device editing work at all (§2).
- **Participants get no controls.** The contribute page is a Google-Drive-style dropzone; every
  setting — caps, compression, byte limit — is admin-side on the link (§5, §10).
- **Compression is paired with a server-enforced `maxBytesPerPhoto`**, so the admin's choice is
  a rule rather than a hint (§10).
- **The link is the permission window.** Contributors edit and remove freely while it is open;
  closing it ends that, and Instagram/Facebook exports are explicitly out of scope (§7).
- **The main publish target is a content album** under `/albums`, consolidated by an admin or
  editor after the event. The event gallery stays as the cheap alternative (§8).
- **Publishing copies the R2 object** into `content-albums/<albumId>/` via a signed S3
  `x-amz-copy-source` request rather than streaming bytes through the Worker (§8).

**Still open:**

- **Passcode on links by default, or bare token?** This would be a *second* code on the same
  page as the claim code, doing something different — a real usability cost. Leaning toward
  bare token unless a specific event needs one.
- **Does a contributor's name auto-fill the album credit** on consolidation, or does the
  editor set credits by hand on the album canvas?
- **Bulk export** (zip a whole event's pool) — deferred, but worth confirming it is a
  follow-up and not a launch requirement.
- **Is a per-contributor byte budget wanted** alongside the photo count? A count cap alone
  does not bound R2 spend if someone turns compression off (§10).
- **Does closing a link leave the contributor page read-only or fully gone?** Recommended
  read-only; one extra branch.
