<script setup lang="ts">
defineProps<{
  footer: {
    tagline: string
    columns: { title: string, links: { label: string, to: string }[] }[]
    copyright: string
    location: string
  }
}>()

const localePath = useLocalePath()

function linkTo(to: string) {
  return to.startsWith('/') ? localePath(to) : to
}
</script>

<template>
  <footer>
    <div class="footer__grid">
      <div>
        <NuxtLink :to="localePath('/')" class="footer__brand"><span class="cu">CU</span>PHOTOCLUB</NuxtLink>
        <p class="footer__tagline">{{ footer.tagline }}</p>
      </div>
      <div v-for="col in footer.columns" :key="col.title" class="footer__col">
        <h4>{{ col.title }}</h4>
        <ul>
          <li v-for="link in col.links" :key="link.label">
            <NuxtLink :to="linkTo(link.to)">{{ link.label }}</NuxtLink>
          </li>
        </ul>
      </div>
    </div>
    <div class="footer__bottom">
      <span>{{ footer.copyright }}</span>
      <span>{{ footer.location }}</span>
    </div>
  </footer>
</template>

<style scoped>
footer {
  background: var(--dark);
  color: rgba(245, 244, 240, 0.7);
  padding: 3.5rem 3rem 2.5rem;
}
.footer__grid {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 3rem;
  max-width: 1380px;
  margin: 0 auto 3rem;
}
.footer__brand {
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-decoration: none;
  color: #F5F4F0;
  display: block;
  margin-bottom: 0.85rem;
}
.footer__brand .cu { color: var(--accent); }
.footer__tagline {
  font-size: 0.7rem;
  color: rgba(245, 244, 240, 0.38);
  line-height: 1.7;
  white-space: pre-line;
}
.footer__col h4 {
  font-size: 0.5rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.1rem;
}
.footer__col ul { list-style: none; display: flex; flex-direction: column; gap: 0.6rem; }
.footer__col a {
  font-size: 0.74rem;
  color: rgba(245, 244, 240, 0.42);
  text-decoration: none;
  transition: color 0.2s;
}
.footer__col a:hover { color: #F5F4F0; }
.footer__bottom {
  max-width: 1380px;
  margin: 0 auto;
  padding-top: 2rem;
  border-top: 1px solid rgba(245, 244, 240, 0.1);
  display: flex;
  justify-content: space-between;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(245, 244, 240, 0.28);
}

@media (max-width: 720px) {
  .footer__grid { grid-template-columns: 1fr 1fr; }
  .footer__bottom { flex-direction: column; gap: 0.5rem; }
}
</style>
