<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'

const props = defineProps<{
  initial?: AlbumInput | null
  submitLabel?: string
  busy?: boolean
}>()
const emit = defineEmits<{ submit: [value: AlbumInput] }>()
const { t } = useI18n()
const localePath = useLocalePath()

function blank(): AlbumInput {
  return {
    title: '', category: '', date: '', published: '', location: '', excerpt: '',
    style: 'essay', placement: 'gallery', coverIndex: 0,
    images: [{ src: '', caption: '' }]
  }
}

// Seed from initial (deep copy so we don't mutate props), else blank.
const form = reactive<AlbumInput>(props.initial ? structuredClone(toRaw(props.initial)) : blank())

function addImage() {
  form.images.push({ src: '', caption: '' })
}
function removeImage(i: number) {
  form.images.splice(i, 1)
  if (form.coverIndex >= form.images.length) form.coverIndex = Math.max(0, form.images.length - 1)
}
function move(i: number, dir: -1 | 1) {
  const j = i + dir
  if (j < 0 || j >= form.images.length) return
  const imgs = form.images
  ;[imgs[i], imgs[j]] = [imgs[j]!, imgs[i]!]
  if (form.coverIndex === i) form.coverIndex = j
  else if (form.coverIndex === j) form.coverIndex = i
}

function onSubmit() {
  emit('submit', structuredClone(toRaw(form)))
}
</script>

<template>
  <form class="af" @submit.prevent="onSubmit">
    <div class="af__grid">
      <div class="field af--span2">
        <label>{{ t('adminForm.title') }}</label>
        <input v-model="form.title" type="text" :placeholder="t('adminForm.titlePlaceholder')">
      </div>
      <div class="field">
        <label>{{ t('adminForm.category') }}</label>
        <input v-model="form.category" type="text" :placeholder="t('adminForm.categoryPlaceholder')">
      </div>
      <div class="field">
        <label>{{ t('adminForm.location') }} <span class="opt">{{ t('adminForm.locationOptional') }}</span></label>
        <input v-model="form.location" type="text" :placeholder="t('adminForm.locationPlaceholder')">
      </div>
      <div class="field">
        <label>{{ t('adminForm.dateDisplay') }}</label>
        <input v-model="form.date" type="text" :placeholder="t('adminForm.datePlaceholder')">
      </div>
      <div class="field">
        <label>{{ t('adminForm.publishedSort') }}</label>
        <input v-model="form.published" type="date">
      </div>
      <div class="field">
        <label>{{ t('adminForm.style') }}</label>
        <select v-model="form.style">
          <option value="essay">{{ t('adminForm.styleEssay') }}</option>
          <option value="sticky">{{ t('adminForm.styleSticky') }}</option>
          <option value="contact">{{ t('adminForm.styleContact') }}</option>
        </select>
      </div>
      <div class="field">
        <label>{{ t('adminForm.placement') }}</label>
        <select v-model="form.placement">
          <option value="gallery">{{ t('adminForm.placementGallery') }}</option>
          <option value="blog">{{ t('adminForm.placementBlog') }}</option>
          <option value="both">{{ t('adminForm.placementBoth') }}</option>
        </select>
      </div>
      <div class="field af--span2">
        <label>{{ t('adminForm.excerpt') }}</label>
        <textarea v-model="form.excerpt" rows="3" :placeholder="t('adminForm.excerptPlaceholder')" />
      </div>
    </div>

    <div class="images">
      <div class="images__head">
        <h3>{{ t('adminForm.images') }} <span class="opt">{{ t('adminForm.coverHint') }}</span></h3>
        <button type="button" class="btn-ghost" @click="addImage">{{ t('adminForm.addImage') }}</button>
      </div>
      <div v-for="(img, i) in form.images" :key="i" class="imgrow">
        <input v-model="img.src" type="text" class="imgrow__src" :placeholder="t('adminForm.imageUrlPlaceholder')">
        <input v-model="img.caption" type="text" class="imgrow__cap" :placeholder="t('adminForm.captionPlaceholder')">
        <label class="imgrow__cover" :title="t('adminForm.setAsCover')">
          <input v-model="form.coverIndex" type="radio" :value="i"> {{ t('adminForm.cover') }}
        </label>
        <div class="imgrow__ops">
          <button type="button" @click="move(i, -1)" :disabled="i === 0">↑</button>
          <button type="button" @click="move(i, 1)" :disabled="i === form.images.length - 1">↓</button>
          <button type="button" class="del" @click="removeImage(i)" :disabled="form.images.length === 1">✕</button>
        </div>
      </div>
    </div>

    <div class="af__actions">
      <NuxtLink :to="localePath('/admin')" class="btn-ghost">{{ t('admin.cancel') }}</NuxtLink>
      <button type="submit" class="btn-solid" :disabled="busy">{{ busy ? t('admin.saving') : (submitLabel || t('admin.save')) }}</button>
    </div>
  </form>
</template>

<style scoped>
.af { display: flex; flex-direction: column; gap: 2rem; }
.af__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
.af--span2 { grid-column: 1 / -1; }
.field { display: flex; flex-direction: column; gap: 0.4rem; }
.field label { font-size: 0.54rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.field .opt { text-transform: none; letter-spacing: 0; color: var(--subtle); }
.field input, .field select, .field textarea {
  font-family: var(--font-sans); font-size: 0.85rem; padding: 0.6rem 0.75rem;
  border: 1px solid var(--subtle); background: #fff; color: var(--dark); outline: none; transition: border-color 0.2s;
}
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); }

.images { border-top: 1px solid var(--subtle); padding-top: 1.5rem; }
.images__head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
.images__head h3 { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; }
.images__head .opt { font-family: var(--font-sans); font-size: 0.7rem; color: var(--muted); font-weight: 300; }
.imgrow { display: grid; grid-template-columns: 1.4fr 1fr auto auto; gap: 0.6rem; align-items: center; margin-bottom: 0.6rem; }
.imgrow input[type=text] { font-size: 0.8rem; padding: 0.5rem 0.6rem; border: 1px solid var(--subtle); background: #fff; outline: none; }
.imgrow input[type=text]:focus { border-color: var(--accent); }
.imgrow__cover { font-size: 0.58rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 0.35rem; white-space: nowrap; }
.imgrow__ops { display: flex; gap: 0.25rem; }
.imgrow__ops button { width: 28px; height: 28px; border: 1px solid var(--subtle); background: #fff; cursor: pointer; transition: border-color 0.2s; }
.imgrow__ops button:hover:not(:disabled) { border-color: var(--accent); }
.imgrow__ops button:disabled { opacity: 0.35; cursor: default; }
.imgrow__ops .del:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }

.af__actions { display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--subtle); padding-top: 1.5rem; }
.btn-ghost { font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.7rem 1.25rem; border: 1px solid var(--subtle); background: none; color: var(--dark); text-decoration: none; cursor: pointer; transition: border-color 0.2s, color 0.2s; }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-solid { font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.7rem 1.5rem; background: var(--dark); color: #F5F4F0; border: none; cursor: pointer; transition: background 0.2s; }
.btn-solid:hover:not(:disabled) { background: var(--accent); }
.btn-solid:disabled { opacity: 0.6; cursor: default; }

@media (max-width: 700px) {
  .af__grid { grid-template-columns: 1fr; }
  .imgrow { grid-template-columns: 1fr; }
}
</style>
