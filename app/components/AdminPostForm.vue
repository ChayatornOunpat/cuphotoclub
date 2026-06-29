<script setup lang="ts">
import type { PostInput } from '~~/shared/types'

const props = defineProps<{
  initial?: PostInput | null
  submitLabel?: string
  busy?: boolean
}>()
const emit = defineEmits<{ submit: [value: PostInput] }>()
const { t } = useI18n()
const localePath = useLocalePath()

function blank(): PostInput {
  return {
    title: '',
    tag: '',
    date: '',
    published: '',
    image: '',
    excerpt: '',
    body: ''
  }
}

const form = reactive<PostInput>(props.initial ? structuredClone(toRaw(props.initial)) : blank())
const draggedParagraph = ref<number | null>(null)

const paragraphs = computed({
  get() {
    const parts = form.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean)
    return parts.length ? parts : ['']
  },
  set(value: string[]) {
    form.body = value.join('\n\n')
  }
})

function updateParagraph(index: number, value: string) {
  const next = [...paragraphs.value]
  next[index] = value
  paragraphs.value = next
}

function addParagraph(after = paragraphs.value.length - 1) {
  const next = [...paragraphs.value]
  next.splice(after + 1, 0, '')
  paragraphs.value = next
}

function removeParagraph(index: number) {
  const next = [...paragraphs.value]
  next.splice(index, 1)
  paragraphs.value = next.length ? next : ['']
}

function moveParagraph(from: number, to: number) {
  if (from === to || to < 0 || to >= paragraphs.value.length) return
  const next = [...paragraphs.value]
  const [item] = next.splice(from, 1)
  if (item === undefined) return
  next.splice(to, 0, item)
  paragraphs.value = next
}

function onDrop(index: number) {
  if (draggedParagraph.value === null) return
  moveParagraph(draggedParagraph.value, index)
  draggedParagraph.value = null
}

function onSubmit() {
  emit('submit', structuredClone(toRaw(form)))
}
</script>

<template>
  <form class="editor" @submit.prevent="onSubmit">
    <div class="editor__bar">
      <NuxtLink :to="localePath('/admin/posts')" class="btn-ghost">{{ t('admin.cancel') }}</NuxtLink>
      <button type="submit" class="btn-solid" :disabled="busy">{{ busy ? t('admin.saving') : (submitLabel || t('admin.save')) }}</button>
    </div>

    <div class="top-dock">
      <section>
        <h2>{{ t('adminEditor.storySettings') }}</h2>
        <div class="dock-fields">
          <div class="field">
            <label>{{ t('adminForm.dateDisplay') }}</label>
            <input v-model="form.date" type="text" :placeholder="t('adminForm.datePlaceholder')">
          </div>
          <div class="field">
            <label>{{ t('adminForm.publishedSort') }}</label>
            <input v-model="form.published" type="date">
          </div>
          <div class="field field--wide">
            <label>{{ t('adminPostForm.image') }}</label>
            <input v-model="form.image" type="text" :placeholder="t('adminPostForm.imagePlaceholder')">
          </div>
        </div>
      </section>
    </div>

    <div class="editor__flow">
      <article class="paper">
        <header class="head">
          <input v-model="form.tag" class="eyeline" :placeholder="t('adminPostForm.tagPlaceholder')">
          <textarea v-model="form.title" rows="2" class="title" :placeholder="t('adminPostForm.titlePlaceholder')" />
          <textarea v-model="form.excerpt" rows="3" class="excerpt" :placeholder="t('adminPostForm.excerptPlaceholder')" />
        </header>

        <section class="hero">
          <img v-if="form.image" :src="form.image" :alt="form.title || t('adminPostForm.image')">
          <div v-else>{{ t('adminEditor.addHero') }}</div>
        </section>

        <section class="body">
          <div
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="paragraph"
            draggable="true"
            @dragstart="draggedParagraph = index"
            @dragover.prevent
            @drop="onDrop(index)"
          >
            <span class="paragraph__handle">{{ String(index + 1).padStart(2, '0') }}</span>
            <textarea :value="paragraph" rows="4" :placeholder="t('adminEditor.paragraphPlaceholder')" @input="updateParagraph(index, ($event.target as HTMLTextAreaElement).value)" />
            <div class="paragraph__ops">
              <button type="button" @click="addParagraph(index)">{{ t('adminEditor.addAfter') }}</button>
              <button type="button" @click="removeParagraph(index)">{{ t('admin.delete') }}</button>
            </div>
          </div>
        </section>
      </article>
    </div>
  </form>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; gap: 1rem; }
.editor__bar { display: flex; justify-content: flex-end; gap: 0.75rem; padding: 0.85rem 0; border-bottom: 1px solid var(--subtle); }
.top-dock { background: var(--body-bg); border: 1px solid var(--subtle); padding: 0.9rem 1rem; }
.top-dock section { display: grid; grid-template-columns: 160px 1fr; gap: 1rem; align-items: start; }
.top-dock h2 { font-family: var(--font-serif); font-size: 1.15rem; font-weight: 300; line-height: 1.1; }
.dock-fields { display: grid; grid-template-columns: 180px 180px minmax(280px, 1fr); gap: 0.75rem; }
.editor__flow { display: flex; justify-content: center; }
.paper { max-width: 820px; width: 100%; justify-self: center; background: var(--body-bg); border: 1px solid var(--subtle); padding: clamp(2rem, 4vw, 4rem); }
.head { margin-bottom: 2rem; }
.eyeline { width: 100%; border: 0; background: transparent; color: var(--accent); outline: none; font-family: var(--font-sans); font-size: 0.58rem; letter-spacing: 0.22em; text-transform: uppercase; margin-bottom: 1rem; }
.title { width: 100%; border: 0; background: transparent; color: var(--dark); outline: none; resize: none; font-family: var(--font-serif); font-size: clamp(2.6rem, 5vw, 4.7rem); line-height: 1.02; font-weight: 200; margin-bottom: 1rem; }
.excerpt { width: 100%; border: 0; border-left: 2px solid var(--accent); background: transparent; color: var(--muted); outline: none; resize: vertical; font-family: var(--font-sans); font-size: 0.95rem; line-height: 1.8; padding-left: 1rem; }
.hero { width: 100%; min-height: 320px; background: var(--paper); display: grid; place-items: center; color: var(--muted); margin-bottom: 2.5rem; }
.hero img { width: 100%; height: 100%; max-height: 520px; object-fit: cover; display: block; }
.body { display: flex; flex-direction: column; gap: 1rem; }
.paragraph { display: grid; grid-template-columns: auto 1fr; gap: 0.8rem; align-items: start; padding-top: 1rem; border-top: 1px solid var(--subtle); cursor: grab; }
.paragraph__handle { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.14em; padding-top: 0.6rem; }
.paragraph textarea { width: 100%; border: 0; background: transparent; color: var(--dark); outline: none; resize: vertical; font-family: var(--font-sans); font-size: 1rem; line-height: 1.95; }
.paragraph__ops { grid-column: 2; display: flex; gap: 0.6rem; }
.paragraph__ops button { border: 0; background: transparent; color: var(--muted); font-family: var(--font-sans); font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.paragraph__ops button:hover { color: var(--accent); }
.field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.9rem; }
.field label { font-size: 0.52rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.field input { width: 100%; border: 1px solid var(--subtle); background: #fff; color: var(--dark); font-family: var(--font-sans); font-size: 0.8rem; padding: 0.58rem 0.65rem; outline: none; }
.field input:focus { border-color: var(--accent); }
.btn-ghost, .btn-solid { font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.7rem 1.1rem; cursor: pointer; text-decoration: none; }
.btn-ghost { border: 1px solid var(--subtle); background: none; color: var(--dark); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-solid { background: var(--dark); color: #F5F4F0; border: none; }
.btn-solid:hover:not(:disabled) { background: var(--accent); }
.btn-solid:disabled { opacity: 0.6; cursor: default; }
@media (max-width: 980px) {
  .top-dock section { grid-template-columns: 1fr; }
  .dock-fields { grid-template-columns: 1fr 1fr; }
  .paper { max-width: none; }
}
@media (max-width: 620px) {
  .paper { padding: 1.25rem; }
  .dock-fields { grid-template-columns: 1fr; }
}
</style>
