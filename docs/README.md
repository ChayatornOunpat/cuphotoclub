# Admin guide (GitHub Pages)

The public admin guide, served by GitHub Pages from this folder. Plain HTML
with no build step — edit a page and push, and Pages republishes within a
minute or two.

`index.html` is a **directory**: it carries only the things everyone needs
(publishing is live, how to sign in, who can do what) and then links out. Each
topic lives in its own short page, so nobody has to scroll past ten sections to
find the one they came for.

```
index.html              directory + roles
getting-started.html    signing in, password, dashboard
concepts.html           content types, visibility, placement, storage
albums.html  posts.html  activities.html  collecting-photos.html
homepage-images.html    hero slideshow, History & Clubroom
members.html            member directory + contact messages
uploading.html          the uploader and image picker
storage.html            R2 usage, largest files, cleanup
admin-tools.html        IAM, settings, logs, pages with no dashboard card
help.html               troubleshooting + glossary
assets/guide.css        every style
assets/guide.js         language, theme, on-this-page, search
```

## Turning Pages on (one time)

Repo → **Settings → Pages** → Source: **Deploy from a branch** →
branch `master`, folder `/docs` → Save.

The guide then lives at `https://<owner>.github.io/cuphotoclub/`.

To serve it from `guide.cuphotoclub.com` instead, add a `CNAME` file in this
folder containing that hostname, then point a DNS CNAME record at
`<owner>.github.io`.

## Editing

Both languages live in the same markup, side by side:

```html
<p>
  <span class="en">English sentence.</span>
  <span class="th">ประโยคภาษาไทย</span>
</p>
```

`html.lang-en` hides every `.th`, `html.lang-th` hides every `.en`. **Always add
both** — a missing `.th` shows an empty gap to Thai readers rather than falling
back to English.

## Adding a page

1. Copy the closest existing page — the `<head>`, top bar and footer are
   identical everywhere, so only the middle changes.
2. Give each `<section>` an `id`, and list those ids in the `.toc` nav at the
   top. The on-this-page highlight is built from `.toc a` at load, so it picks
   the new section up with no extra wiring.
3. Add a `<a class="card">` for it in `index.html`, inside the right
   `.dir` grid. Put searchable words in `data-keys` — including Thai ones,
   since the directory filter matches against them.
4. Fix the `.updown` prev/next links on the pages either side of it.

## Screenshots

Put them in `docs/img/` and replace the placeholder:

```html
<figure>
  <div class="shot-todo">…</div>   <!-- replace this line -->
  <img src="img/album-editor.png" alt="The album editor">
  <figcaption><span class="en">…</span><span class="th">…</span></figcaption>
</figure>
```

Compress before committing — these live in git forever. Aim for under 300 KB
each; 1600px wide is plenty.

## Keeping it honest

The guide describes admin pages that change. When you change admin behaviour,
check whether a page here still tells the truth. Most likely to go stale:
**index.html** (the roles table, if middleware changes), **admin-tools.html**
(its "pages with no card" list, if something gets a dashboard card), and
**albums.html** (display styles).

Dev-facing design notes live in [`dev/`](dev/), not here.
