<script setup lang="ts">
// Standalone contact page — reachable at /contacts but deliberately NOT wired
// into the live app: no nav/footer entry (those come from content/site.yml) and
// noindex, so it can be reviewed before it goes public. The existing
// /contact page (message form) is untouched.
definePageMeta({ layout: 'site' })

const { locale } = useI18n()

// ── Club details ──────────────────────────────────────────────────────────
// Address matches the Organization structured data in app.vue — keep the two in
// sync if either changes.
const EMAILS = [
  { address: 'cuphotoclub2023@gmail.com', role: { en: 'General enquiries', th: 'ติดต่อทั่วไป' } },
  // MOCK — placeholder for the club's second Gmail so the two-address layout is
  // final. Swap in the real address before this page goes live.
  { address: 'cuphotoclub.example@gmail.com', role: { en: 'Bookings & collaborations', th: 'งานถ่ายภาพและความร่วมมือ' } }
]

const SOCIALS = [
  { label: 'Instagram', handle: '@cuphotoclub', icon: 'simple-icons:instagram', url: 'https://www.instagram.com/cuphotoclub/' },
  { label: 'Facebook', handle: 'CU Photo Club', icon: 'simple-icons:facebook', url: 'https://www.facebook.com/cuphoto' },
  { label: 'Linktree', handle: 'linktr.ee/CUPhotoClub', icon: 'simple-icons:linktree', url: 'https://linktr.ee/CUPhotoClub' }
]

// Query-string embed (no API key needed) + a deep link for "open in Maps".
const MAP_QUERY = 'อาคารจุลจักรพงษ์ จุฬาลงกรณ์มหาวิทยาลัย'
const mapEmbedSrc = `https://www.google.com/maps?q=${encodeURIComponent(MAP_QUERY)}&z=17&output=embed`
const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(MAP_QUERY)}`

// Copy lives here rather than in i18n/locales while the page is a draft — one
// place to edit, and no churn in the shared locale files until it ships.
const COPY = {
  en: {
    kicker: 'Contact',
    title: 'Get in',
    titleEm: 'touch',
    lead: 'Questions about joining, requests for coverage, or archive enquiries — write to us, or come find the clubroom.',
    name: 'CU Photo Club',
    nameSub: 'ชมรมศิลปะการถ่ายภาพแห่งจุฬาลงกรณ์มหาวิทยาลัย',
    emailLabel: 'Email',
    socialLabel: 'Elsewhere',
    whereLabel: 'Clubroom',
    address: ['3rd floor, Chulachakrapong Building', 'Phyathai Road, Wang Mai, Pathum Wan', 'Bangkok 10330, Thailand'],
    mapOpen: 'Open in Google Maps',
    mapTitle: 'Map showing the CU Photo Club clubroom at Chulachakrapong Building'
  },
  th: {
    kicker: 'ติดต่อเรา',
    title: 'ติดต่อ',
    titleEm: 'ชมรม',
    lead: 'สอบถามเรื่องการสมัครสมาชิก งานถ่ายภาพ หรือคลังภาพของชมรม เขียนมาถึงเราได้ หรือแวะมาที่ห้องชมรม',
    name: 'ชมรมศิลปะการถ่ายภาพแห่งจุฬาลงกรณ์มหาวิทยาลัย',
    nameSub: 'CU Photo Club',
    emailLabel: 'อีเมล',
    socialLabel: 'ช่องทางอื่น',
    whereLabel: 'ห้องชมรม',
    address: ['ชั้น 3 อาคารจุลจักรพงษ์', 'ถนนพญาไท แขวงวังใหม่ เขตปทุมวัน', 'กรุงเทพมหานคร 10330'],
    mapOpen: 'เปิดใน Google Maps',
    mapTitle: 'แผนที่ห้องชมรมศิลปะการถ่ายภาพ อาคารจุลจักรพงษ์'
  }
} as const

const c = computed(() => (locale.value === 'th' ? COPY.th : COPY.en))
const emails = computed(() => EMAILS.filter(e => e.address))

useSeoMeta({
  title: () => c.value.kicker,
  description: () => c.value.lead,
  // Draft page: keep it out of search results until it's linked up.
  robots: 'noindex, nofollow'
})
</script>

<template>
  <div class="contacts-page">
    <header class="page-head">
      <p class="page-head__kicker">{{ c.kicker }}</p>
      <h1 class="page-head__title">{{ c.title }}<br><em>{{ c.titleEm }}</em></h1>
      <p class="page-head__lead" :lang="textLang(c.lead)">{{ c.lead }}</p>
    </header>

    <div class="contacts-body">
      <!-- Identity sits alone in the left rail; everything actionable is on the
           right, so the page reads name → email → elsewhere → place. -->
      <section class="reach">
        <div class="reach__who">
          <h2 class="who__name" :lang="textLang(c.name)">{{ c.name }}</h2>
          <p class="who__sub" :lang="textLang(c.nameSub)">{{ c.nameSub }}</p>
        </div>

        <div class="reach__lines">
          <p class="label">{{ c.emailLabel }}</p>
          <ul class="mails">
            <li v-for="mail in emails" :key="mail.address">
              <a :href="`mailto:${mail.address}`" class="mail">{{ mail.address }}</a>
              <span class="mail__role" :lang="textLang(locale === 'th' ? mail.role.th : mail.role.en)">
                {{ locale === 'th' ? mail.role.th : mail.role.en }}
              </span>
            </li>
          </ul>

          <p class="label label--spaced">{{ c.socialLabel }}</p>
          <ul class="socials">
            <li v-for="s in SOCIALS" :key="s.label">
              <a :href="s.url" target="_blank" rel="noopener noreferrer" class="social">
                <Icon :name="s.icon" class="social__icon" aria-hidden="true" />
                <span class="social__handle">{{ s.handle }}</span>
              </a>
            </li>
          </ul>
        </div>
      </section>

      <!-- Place: the map carries the location, the address is its caption -->
      <section class="where">
        <div class="where__map">
          <iframe
            class="where__frame"
            :src="mapEmbedSrc"
            :title="c.mapTitle"
            loading="lazy"
            referrerpolicy="no-referrer-when-downgrade"
          />
        </div>
        <div class="where__caption">
          <div>
            <p class="label">{{ c.whereLabel }}</p>
            <address class="where__address">
              <span v-for="line in c.address" :key="line" :lang="textLang(line)">{{ line }}</span>
            </address>
          </div>
          <a :href="mapLink" target="_blank" rel="noopener noreferrer" class="where__link">
            {{ c.mapOpen }}
            <Icon name="heroicons:arrow-up-right" class="where__link-icon" aria-hidden="true" />
          </a>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* Restraint is the whole design here: one accent (the kicker + hover), one
   hairline (under the header), no boxes, no repeated row rules. Hierarchy comes
   from type size and whitespace instead of borders. */
.contacts-page { min-height: 100vh; }

/* ── Page header — same rhythm as the members page ── */
.page-head {
  padding: 10rem 3rem 5rem;
  max-width: 1380px;
  margin: 0 auto;
  border-bottom: 1px solid var(--subtle);
}
.page-head__kicker {
  font-size: 0.54rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.5rem;
}
.page-head__title {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7vw, 7rem);
  font-weight: 200;
  line-height: 0.98;
  letter-spacing: -0.01em;
  color: var(--dark);
  margin-bottom: 1.5rem;
}
.page-head__title em { font-style: italic; color: var(--accent); }
.page-head__lead {
  font-size: 0.9rem;
  color: var(--muted);
  max-width: 460px;
  line-height: 1.8;
}

.contacts-body {
  max-width: 1380px;
  margin: 0 auto;
  padding: 5.5rem 3rem 8rem;
}

/* Shared small-caps label — the page's only repeated device */
.label {
  font-size: 0.52rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 1.1rem;
}
.label--spaced { margin-top: 3.25rem; }

/* ── Name · reach ── */
.reach {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 4rem;
  align-items: start;
  padding-bottom: 6.5rem;
}
.who__name {
  font-family: var(--font-serif);
  font-size: clamp(1.8rem, 3vw, 2.6rem);
  font-weight: 200;
  line-height: 1.15;
  letter-spacing: -0.01em;
  color: var(--dark);
  max-width: 22ch;
}
.who__sub {
  margin-top: 1rem;
  font-size: 0.76rem;
  color: var(--muted);
  line-height: 1.75;
  max-width: 34ch;
}

ul { list-style: none; padding: 0; margin: 0; }

/* Emails are the primary action, so they get the largest type on the page
   after the title — spacing separates them, not rules. */
.mails li + li { margin-top: 1.75rem; }
.mail {
  display: block;
  font-family: var(--font-serif);
  font-size: clamp(1.2rem, 2.2vw, 1.6rem);
  font-weight: 300;
  line-height: 1.25;
  color: var(--dark);
  text-decoration: none;
  overflow-wrap: anywhere;
  transition: color 0.2s;
}
.mail:hover { color: var(--accent); }
.mail__role {
  display: block;
  margin-top: 0.4rem;
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

/* Icon + handle only. The platform name is already in the handle, so printing
   both was redundant noise. */
.socials li + li { margin-top: 0.9rem; }
.social {
  display: inline-flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 0.8rem;
  color: var(--dark);
  text-decoration: none;
  transition: color 0.2s;
}
.social:hover { color: var(--accent); }
.social__icon { width: 0.95rem; height: 0.95rem; color: var(--muted); transition: color 0.2s; }
.social:hover .social__icon { color: var(--accent); }
.social__handle { overflow-wrap: anywhere; }

/* ── Place ── */
.where__map {
  aspect-ratio: 21 / 9;
  background: var(--paper);
  overflow: hidden;
}
/* Desaturated so the map sits under the photography rather than competing with
   it; it returns to full colour on hover, when you're actually reading it. */
.where__frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
  filter: grayscale(1) contrast(1.05);
  transition: filter 0.4s ease;
}
.where__map:hover .where__frame { filter: none; }

.where__caption {
  margin-top: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 2rem;
  flex-wrap: wrap;
}
.where__address {
  font-style: normal;
  font-size: 0.84rem;
  color: var(--dark);
  line-height: 1.8;
}
.where__address span { display: block; }
.where__link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.56rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.2s;
}
.where__link:hover { color: var(--accent); }
.where__link-icon { width: 0.8rem; height: 0.8rem; }

@media (max-width: 1000px) {
  .reach { grid-template-columns: 1fr; gap: 3.5rem; padding-bottom: 5rem; }
  .where__map { aspect-ratio: 16 / 10; }
}

@media (max-width: 720px) {
  .page-head { padding: 7.5rem 1.5rem 3rem; }
  .contacts-body { padding: 3.5rem 1.5rem 5rem; }
  .label--spaced { margin-top: 2.5rem; }
  .where__map { aspect-ratio: 4 / 5; }
  .where__caption { align-items: flex-start; }
}
</style>
