<script setup lang="ts">
definePageMeta({ layout: false })

useHead({
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    {
      rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Anuphan:wght@300;400;500;600&family=IBM+Plex+Sans+Thai+Looped:wght@300;400;500;600&family=Noto+Sans+Thai:wght@300;400;500;600&family=Noto+Serif+Thai:wght@300;400;500;600&family=Sarabun:wght@300;400;500;600&display=swap'
    }
  ]
})

const specimens = [
  {
    name: 'Noto Serif Thai',
    role: 'Display / editorial serif',
    mood: 'Closest to Spectral: serious, literary, quiet.',
    className: 'font-bench--noto-serif-thai',
    verdict: 'Best for hero headlines, pull quotes, and section titles.'
  },
  {
    name: 'Noto Sans Thai',
    role: 'Body / UI sans',
    mood: 'Neutral, stable, readable. The safest bilingual support choice.',
    className: 'font-bench--noto-sans-thai',
    verdict: 'Best conservative body/UI companion.'
  },
  {
    name: 'IBM Plex Sans Thai Looped',
    role: 'Body / UI sans',
    mood: 'More designed than Noto Sans, still calm and editorial.',
    className: 'font-bench--ibm-plex-thai',
    verdict: 'My favorite UI/body candidate for this brand.'
  },
  {
    name: 'Sarabun',
    role: 'Institutional sans',
    mood: 'Official, familiar, university-adjacent.',
    className: 'font-bench--sarabun',
    verdict: 'Strong credibility, slightly administrative.'
  },
  {
    name: 'Anuphan',
    role: 'Modern sans',
    mood: 'Warm, clear, contemporary.',
    className: 'font-bench--anuphan',
    verdict: 'Friendly and polished, less legacy/editorial.'
  },
  {
    name: 'LINE Seed Sans TH',
    role: 'Modern sans, self-host candidate',
    mood: 'Clean, premium, contemporary.',
    className: 'font-bench--line-seed',
    verdict: 'Included for comparison if installed locally; otherwise falls back.'
  }
]

const pairs = [
  {
    name: 'Conservative',
    className: 'pair--conservative',
    note: 'Most reliable: editorial display with neutral body.'
  },
  {
    name: 'Designed',
    className: 'pair--designed',
    note: 'Best balance of legacy and personality.'
  },
  {
    name: 'Institutional',
    className: 'pair--institutional',
    note: 'Feels closest to university/public-sector Thai communication.'
  },
  {
    name: 'Contemporary',
    className: 'pair--contemporary',
    note: 'Softer, younger, and more approachable.'
  }
]
</script>

<template>
  <main class="bench">
    <header class="bench__hero">
      <NuxtLink to="/" class="bench__back">CU PHOTO CLUB</NuxtLink>
      <p class="bench__kicker">Thai Type Bench · CU Photo Club</p>
      <h1>ทดสอบฟอนต์ไทย<br><span>for an editorial photo archive</span></h1>
      <p class="bench__lead">
        Compare Thai type in the roles this site actually uses: cinematic display,
        quiet body copy, small editorial labels, metadata, and bilingual UI.
      </p>
    </header>

    <section class="bench__section">
      <div class="bench__section-head">
        <p class="bench__num">01</p>
        <h2>Single Families</h2>
      </div>

      <article
        v-for="specimen in specimens"
        :key="specimen.name"
        class="specimen"
        :class="specimen.className"
      >
        <div class="specimen__meta">
          <p class="specimen__role">{{ specimen.role }}</p>
          <h3>{{ specimen.name }}</h3>
          <p>{{ specimen.mood }}</p>
          <span>{{ specimen.verdict }}</span>
        </div>
        <div class="specimen__sample">
          <p class="sample__eyebrow">ประวัติของเรา · Est. 1967</p>
          <h4>มองโลกผ่านเลนส์ ไปด้วยกัน</h4>
          <p class="sample__body">
            ชมรมถ่ายภาพจุฬาลงกรณ์มหาวิทยาลัยบันทึกชีวิต วัฒนธรรม และเรื่องราวของผู้คน
            ผ่านภาพถ่ายที่ตั้งใจ เรียบง่าย และมีความทรงจำของเวลาอยู่ในทุกเฟรม
          </p>
          <div class="sample__row">
            <span>คลังภาพ</span>
            <span>12 คอลเลกชัน</span>
            <span>Bangkok, Thailand</span>
          </div>
        </div>
      </article>
    </section>

    <section class="bench__section bench__pairs">
      <div class="bench__section-head">
        <p class="bench__num">02</p>
        <h2>Pairings</h2>
      </div>

      <article
        v-for="pair in pairs"
        :key="pair.name"
        class="pair"
        :class="pair.className"
      >
        <div>
          <p class="pair__label">{{ pair.name }}</p>
          <h3>ภาพถ่ายทุกภาพคือจดหมายถึงอนาคต</h3>
        </div>
        <div>
          <p class="pair__body">
            {{ pair.note }} ทดลองอ่านในย่อหน้าปกติที่มีทั้งคำสั้น คำยาว ตัวเลข 1967
            และชื่อภาษาอังกฤษอย่าง CU Photo Club เพื่อดูจังหวะของสองภาษาในบรรทัดเดียวกัน
          </p>
          <button type="button">เข้าร่วมชมรม</button>
        </div>
      </article>
    </section>
  </main>
</template>

<style scoped>
.bench {
  min-height: 100vh;
  background: var(--body-bg);
  color: var(--dark);
}

.bench__hero {
  min-height: 72svh;
  background:
    linear-gradient(to bottom, rgba(12, 12, 10, 0.28), rgba(12, 12, 10, 0.92)),
    url('https://picsum.photos/seed/thai-type-bench/1800/1100') center / cover;
  color: #F5F4F0;
  padding: 2rem 3rem 4rem;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.bench__back {
  position: absolute;
  top: 2rem;
  left: 3rem;
  color: rgba(245, 244, 240, 0.62);
  text-decoration: none;
  font-size: 0.65rem;
  letter-spacing: 0.18em;
}

.bench__kicker,
.bench__num,
.specimen__role,
.pair__label,
.sample__eyebrow,
.sample__row,
button {
  font-family: var(--font-sans);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.bench__kicker {
  color: var(--accent);
  font-size: 0.62rem;
  margin-bottom: 1.25rem;
}

.bench__hero h1 {
  font-family: var(--font-serif);
  font-size: clamp(3.8rem, 8.5vw, 9rem);
  font-weight: 200;
  line-height: 0.95;
  max-width: 1100px;
}

.bench__hero h1 span {
  color: rgba(245, 244, 240, 0.48);
  font-style: italic;
}

.bench__lead {
  margin-top: 2rem;
  max-width: 560px;
  color: rgba(245, 244, 240, 0.58);
  line-height: 1.8;
  font-size: 0.92rem;
}

.bench__section {
  padding: 5rem 3rem;
  max-width: 1440px;
  margin: 0 auto;
}

.bench__section-head {
  display: grid;
  grid-template-columns: 90px 1fr;
  align-items: baseline;
  border-bottom: 1px solid var(--subtle);
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
}

.bench__num {
  color: var(--accent);
  font-size: 0.62rem;
}

.bench__section h2 {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 3vw, 3.4rem);
  font-weight: 300;
}

.specimen {
  display: grid;
  grid-template-columns: minmax(240px, 0.42fr) 1fr;
  gap: 3rem;
  padding: 2.5rem 0;
  border-bottom: 1px solid var(--subtle);
}

.specimen__meta h3 {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  font-weight: 300;
  margin: 0.6rem 0 1rem;
}

.specimen__meta p {
  color: var(--muted);
  line-height: 1.7;
}

.specimen__meta span {
  display: block;
  margin-top: 1.2rem;
  color: var(--accent);
  font-size: 0.82rem;
  line-height: 1.6;
}

.specimen__role {
  color: var(--muted);
  font-size: 0.54rem;
}

.font-bench--noto-serif-thai {
  --bench-font: 'Noto Serif Thai', 'Spectral', serif;
}

.font-bench--noto-serif-thai .specimen__sample,
.font-bench--noto-serif-thai .sample__body,
.font-bench--noto-serif-thai .specimen__sample h4 {
  font-family: 'Noto Serif Thai', 'Spectral', serif;
}

.font-bench--noto-sans-thai {
  --bench-font: 'Noto Sans Thai', 'Inter', sans-serif;
}

.font-bench--noto-sans-thai .specimen__sample,
.font-bench--noto-sans-thai .sample__body,
.font-bench--noto-sans-thai .specimen__sample h4 {
  font-family: 'Noto Sans Thai', 'Inter', sans-serif;
}

.font-bench--ibm-plex-thai {
  --bench-font: 'IBM Plex Sans Thai Looped', 'Noto Sans Thai', sans-serif;
}

.font-bench--ibm-plex-thai .specimen__sample,
.font-bench--ibm-plex-thai .sample__body,
.font-bench--ibm-plex-thai .specimen__sample h4 {
  font-family: 'IBM Plex Sans Thai Looped', 'Noto Sans Thai', sans-serif;
}

.font-bench--sarabun {
  --bench-font: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

.font-bench--sarabun .specimen__sample,
.font-bench--sarabun .sample__body,
.font-bench--sarabun .specimen__sample h4 {
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

.font-bench--anuphan {
  --bench-font: 'Anuphan', 'Noto Sans Thai', sans-serif;
}

.font-bench--anuphan .specimen__sample,
.font-bench--anuphan .sample__body,
.font-bench--anuphan .specimen__sample h4 {
  font-family: 'Anuphan', 'Noto Sans Thai', sans-serif;
}

.font-bench--line-seed {
  --bench-font: 'LINE Seed Sans TH', 'Noto Sans Thai', sans-serif;
}

.font-bench--line-seed .specimen__sample,
.font-bench--line-seed .sample__body,
.font-bench--line-seed .specimen__sample h4 {
  font-family: 'LINE Seed Sans TH', 'Noto Sans Thai', sans-serif;
}

.specimen__sample {
  font-family: var(--bench-font);
  background: #fff;
  border-left: 2px solid var(--accent);
  padding: clamp(1.5rem, 3vw, 3rem);
}

.sample__eyebrow {
  color: var(--accent);
  font-size: 0.62rem;
  letter-spacing: 0.06em;
  text-transform: none;
}

.sample__sample,
.sample__body {
  font-family: var(--bench-font);
}

.specimen__sample h4 {
  font-family: var(--bench-font);
  font-size: clamp(2.5rem, 5.4vw, 5.8rem);
  font-weight: 300;
  line-height: 1.08;
  margin: 1.4rem 0;
}

.sample__body {
  max-width: 720px;
  color: var(--muted);
  font-size: 1.08rem;
  line-height: 1.95;
}

.sample__row {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 2rem;
  margin-top: 2rem;
  color: var(--dark);
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  text-transform: none;
}

.bench__pairs {
  padding-top: 2rem;
}

.pair {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 3rem;
  padding: 3rem;
  margin-bottom: 1rem;
  background: #2C2A26;
  color: #F0EDE6;
}

.pair__label {
  color: var(--accent);
  font-size: 0.58rem;
  margin-bottom: 1rem;
}

.pair--conservative {
  --display-font: 'Noto Serif Thai', 'Spectral', serif;
  --body-font: 'Noto Sans Thai', 'Inter', sans-serif;
}

.pair--conservative h3 {
  font-family: 'Noto Serif Thai', 'Spectral', serif;
}

.pair--conservative .pair__body {
  font-family: 'Noto Sans Thai', 'Inter', sans-serif;
}

.pair--designed {
  --display-font: 'Noto Serif Thai', 'Spectral', serif;
  --body-font: 'IBM Plex Sans Thai Looped', 'Noto Sans Thai', sans-serif;
}

.pair--designed h3 {
  font-family: 'Noto Serif Thai', 'Spectral', serif;
}

.pair--designed .pair__body {
  font-family: 'IBM Plex Sans Thai Looped', 'Noto Sans Thai', sans-serif;
}

.pair--institutional {
  --display-font: 'Noto Serif Thai', 'Spectral', serif;
  --body-font: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

.pair--institutional h3 {
  font-family: 'Noto Serif Thai', 'Spectral', serif;
}

.pair--institutional .pair__body {
  font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
}

.pair--contemporary {
  --display-font: 'Noto Serif Thai', 'Spectral', serif;
  --body-font: 'Anuphan', 'Noto Sans Thai', sans-serif;
}

.pair--contemporary h3 {
  font-family: 'Noto Serif Thai', 'Spectral', serif;
}

.pair--contemporary .pair__body {
  font-family: 'Anuphan', 'Noto Sans Thai', sans-serif;
}

.pair h3 {
  font-family: var(--display-font);
  font-size: clamp(2.2rem, 4vw, 4.8rem);
  line-height: 1.1;
  font-weight: 300;
}

.pair__body {
  font-family: var(--body-font);
  color: rgba(240, 237, 230, 0.64);
  font-size: 1rem;
  line-height: 1.9;
}

button {
  margin-top: 2rem;
  background: transparent;
  border: 1px solid rgba(240, 237, 230, 0.24);
  color: #F0EDE6;
  padding: 0.85rem 1.2rem;
  font-size: 0.62rem;
  letter-spacing: 0.08em;
  text-transform: none;
}

@media (max-width: 820px) {
  .bench__hero,
  .bench__section {
    padding-left: 1.5rem;
    padding-right: 1.5rem;
  }

  .bench__back {
    left: 1.5rem;
  }

  .specimen,
  .pair,
  .bench__section-head {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }

  .pair {
    padding: 1.5rem;
  }
}
</style>
