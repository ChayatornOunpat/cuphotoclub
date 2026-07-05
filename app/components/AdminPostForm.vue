<script setup lang="ts">
import type { PostInput, PostBlock, PostBlockType, ContentStatus, HeroStyle } from '~~/shared/types'

const props = defineProps<{
  initial?: PostInput | null
  submitLabel?: string
  busy?: boolean
}>()
const emit = defineEmits<{ submit: [value: PostInput]; 'update:title': [value: string] }>()
const { t } = useI18n()
const localePath = useLocalePath()

// ─── Block palette ───────────────────────────────────────────────────────────

const PALETTE = [
  { type: 'text'       as PostBlockType, label: 'Paragraph',  group: 'Text',   description: 'Standard body text for running prose.' },
  { type: 'lead'       as PostBlockType, label: 'Lead',        group: 'Text',   description: 'Opening paragraph with an accent-coloured left border to set the tone.' },
  { type: 'heading'    as PostBlockType, label: 'Heading',     group: 'Text',   description: 'Large serif heading that marks a major new section.' },
  { type: 'subheading' as PostBlockType, label: 'Subheading',  group: 'Text',   description: 'Smaller serif heading for sub-sections within a section.' },
  { type: 'pullquote'  as PostBlockType, label: 'Pull Quote',  group: 'Text',   description: 'Large italic quote in accent colour with a left border — great for emphasis.' },
  { type: 'blockquote' as PostBlockType, label: 'Blockquote',  group: 'Text',   description: 'Quoted text with optional attribution, tinted background, and accent border.' },
  { type: 'inset'      as PostBlockType, label: 'Callout',     group: 'Text',   description: 'Highlighted box for asides, editorial notes, or sidebars.' },
  { type: 'qanda'      as PostBlockType, label: 'Q & A',       group: 'Text',   description: 'Labelled question-and-answer pair — ideal for interview articles.' },
  { type: 'image'      as PostBlockType, label: 'Image',       group: 'Visual', description: 'Inline photo with optional caption. Can break out wider than the text column.' },
  { type: 'photo-full' as PostBlockType, label: 'Full Bleed',  group: 'Visual', description: 'Full viewport-width photograph for maximum visual impact.' },
  { type: 'photo-pair' as PostBlockType, label: 'Photo Pair',  group: 'Visual', description: 'Two photos displayed side by side, spanning the full page width.' },
  { type: 'divider'    as PostBlockType, label: 'Divider',     group: 'Visual', description: 'Centred dot-mark section break. Adds visual breathing room.' },
]

const BLOCK_LABEL: Record<PostBlockType, string> = Object.fromEntries(
  PALETTE.map(p => [p.type, p.label])
) as Record<PostBlockType, string>

function uid(): string {
  return Math.random().toString(36).slice(2, 9)
}

function makeBlock(type: PostBlockType): PostBlock {
  const id = uid()
  if (type === 'text')        return { id, type, content: '' }
  if (type === 'lead')        return { id, type, content: '' }
  if (type === 'heading')     return { id, type, content: '' }
  if (type === 'subheading')  return { id, type, content: '' }
  if (type === 'pullquote')   return { id, type, content: '' }
  if (type === 'blockquote')  return { id, type, content: '', cite: '' }
  if (type === 'image')       return { id, type, src: '', caption: '', breakout: false }
  if (type === 'photo-full')  return { id, type, src: '', caption: '' }
  if (type === 'photo-pair')  return { id, type, src1: '', src2: '', caption: '' }
  if (type === 'divider')     return { id, type }
  if (type === 'inset')       return { id, type, content: '' }
  return { id, type: 'qanda', question: '', answer: '' }
}

// ─── Form state ──────────────────────────────────────────────────────────────

const HERO_STYLES: { value: HeroStyle; label: string }[] = [
  { value: 'standard',     label: 'Standard' },
  { value: 'dark-full',    label: 'Dark Full Bleed' },
  { value: 'split',        label: 'Split Hero' },
  { value: 'minimal-dark', label: 'Minimal Dark' },
]

const VISIBILITY_OPTIONS: { value: ContentStatus, label: string, description: string }[] = [
  { value: 'draft', label: 'Draft', description: 'Admin only. Hidden from the public site and direct links.' },
  { value: 'link-only', label: 'Link only', description: 'Direct URL works, but it is hidden from lists and the homepage.' },
  { value: 'public', label: 'Public', description: 'Shown on the site and available by direct link.' }
]

function blank(): PostInput {
  return {
    title: '', tag: '', date: '', published: '', visibility: 'draft', image: '', excerpt: '',
    heroStyle: 'standard', author: '', authorBio: '', authorAvatar: '',
    blocks: [makeBlock('text')],
  }
}

const form = reactive<PostInput>(
  props.initial ? structuredClone(toRaw(props.initial)) : blank()
)

form.visibility = form.visibility ?? 'public'
if (!form.blocks?.length) form.blocks = [makeBlock('text')]

watch(() => form.title, val => emit('update:title', val), { immediate: true })

// ─── Block picker modal ──────────────────────────────────────────────────────

const paletteOpen = ref(false)
const insertAt = ref<number | null>(null) // null = append

function openPalette(afterIndex: number | null = null) {
  insertAt.value = afterIndex
  paletteOpen.value = true
}

function addBlock(type: PostBlockType) {
  const block = makeBlock(type)
  const at = insertAt.value
  if (at === null || at >= form.blocks.length) {
    form.blocks.push(block)
  } else {
    form.blocks.splice(at + 1, 0, block)
  }
  paletteOpen.value = false
  insertAt.value = null
}

function removeBlock(index: number) {
  form.blocks.splice(index, 1)
  if (!form.blocks.length) form.blocks.push(makeBlock('text'))
}

function onPaletteKey(e: KeyboardEvent) {
  if (e.key === 'Escape') paletteOpen.value = false
}

watch(paletteOpen, v => {
  if (v) document.addEventListener('keydown', onPaletteKey)
  else document.removeEventListener('keydown', onPaletteKey)
})

// ─── Drag & drop ─────────────────────────────────────────────────────────────

const dragFrom = ref<number | null>(null)
const dragOver = ref<number | null>(null)

function onDragStart(i: number) { dragFrom.value = i }
function onDragOver(i: number)  { dragOver.value = i }
function onDragEnd()            { dragFrom.value = null; dragOver.value = null }

function onDrop(toIndex: number) {
  const from = dragFrom.value
  if (from === null || from === toIndex) { onDragEnd(); return }
  const next = [...form.blocks]
  const [item] = next.splice(from, 1)
  next.splice(toIndex, 0, item!)
  form.blocks = next
  onDragEnd()
}

// ─── Templates ───────────────────────────────────────────────────────────────

interface Template {
  name: string
  description: string
  blocks: () => PostBlock[]
}

const TEMPLATES: Template[] = [
  {
    name: 'Essay',
    description: 'Long-form editorial with pull quote and section breaks',
    blocks: () => [
      { id: uid(), type: 'lead', content: 'There is a particular kind of stillness that precedes a great photograph. It is not the stillness of waiting — it is the stillness of attention, of having quieted every thought except the one unfolding in front of you.' },
      { id: uid(), type: 'text', content: 'Most photographers will tell you the decisive moment is a matter of reflex. You see it, you press. But spend enough time with the craft and you begin to suspect the opposite: that the shutter is the last thing to happen, that everything important has already occurred by the time your finger moves.' },
      { id: uid(), type: 'text', content: 'This is not a comfortable idea for a generation raised on burst mode. We have trained ourselves to shoot first and look later, trusting that somewhere inside a thousand frames the right image is hiding. Sometimes it is. More often, what we find is a thousand variations on the same inattentiveness.' },
      { id: uid(), type: 'pullquote', content: 'The camera is an instrument that teaches people how to see without a camera.' },
      { id: uid(), type: 'heading', content: 'Learning to Wait' },
      { id: uid(), type: 'text', content: 'Patience in photography is not passive. It means reading a scene — understanding how the light will move, where a subject is likely to pause, which background element will resolve into something meaningful and which will remain noise. It is anticipation made physical, a kind of muscular readiness held in suspension.' },
      { id: uid(), type: 'blockquote', content: 'I always think about the image before I raise the camera. If you are not sure of what you are going to photograph, what you will end up with is chaos.', cite: '— Henri Cartier-Bresson' },
      { id: uid(), type: 'divider' },
      { id: uid(), type: 'text', content: 'The photographs we remember are rarely the ones taken quickly. They are the ones where everything — light, subject, geometry, moment — arrived at the same instant. That convergence is almost never accidental. It is the reward for having been present long enough for the scene to offer itself.' },
    ],
  },
  {
    name: 'Interview',
    description: 'Q & A format with a portrait and a closing callout',
    blocks: () => [
      { id: uid(), type: 'lead', content: 'Maya Osei has been shooting documentary work for twelve years, most recently along the Lake Erie shoreline. We sat down with her after her talk at the Spring Symposium to talk about process, patience, and why she still shoots film.' },
      { id: uid(), type: 'image', src: 'https://picsum.photos/seed/tpl_int_portrait/900/600', caption: 'Maya Osei at the CU Photo spring symposium, April 2026.', breakout: false },
      { id: uid(), type: 'qanda', question: 'Your work is very tied to place. How do you choose where to spend your time?', answer: 'Honestly, I follow discomfort. If a place makes me feel like I don\'t quite understand it yet, that\'s usually a sign I need to stay longer. The Lake Erie project started because I drove past the shoreline every day for a year and never once stopped. That bothered me enough to do something about it.' },
      { id: uid(), type: 'qanda', question: 'You still shoot on medium format film. Does that slow you down intentionally?', answer: 'It slows me down whether I want it to or not, which is actually the point. You get twelve frames on a roll. You can\'t just fire continuously and hope something lands. Every frame has a cost — in money, in time, in waiting. That constraint changes how you look. You become a lot more selective before you even raise the camera.' },
      { id: uid(), type: 'qanda', question: 'How do you approach photographing people you\'ve just met?', answer: 'I try not to be useful too fast. If I show up and immediately start photographing, people perform. They give me the version of themselves they think I want. So I\'ll spend an hour just talking, helping with something, being a presence that isn\'t always pointing a lens at them. By the time I do raise the camera, they\'ve usually forgotten it\'s there.' },
      { id: uid(), type: 'divider' },
      { id: uid(), type: 'qanda', question: 'What do you wish someone had told you earlier in your career?', answer: 'That editing is more important than shooting. Anyone can go somewhere interesting and take a thousand pictures. The work happens when you sit with them for a year and figure out which eight actually say something. I used to be terrified of throwing frames away. Now I think ruthlessness is a form of respect — for the subject, for the viewer, for yourself.' },
      { id: uid(), type: 'qanda', question: 'What are you working on next?', answer: 'I\'m spending the summer in the Cuyahoga Valley. I\'m interested in what happens to landscapes when industry leaves — the way nature reclaims things, but also the way absence stays visible. There\'s something about that in-between state that feels very present right now.' },
      { id: uid(), type: 'inset', content: 'Maya Osei\'s work is currently on view at the Transformer Station through July 12. Her monograph, Still Water, is available through Aperture.' },
    ],
  },
  {
    name: 'Photo Essay',
    description: 'Image-led story with full-bleed photos and minimal text',
    blocks: () => [
      { id: uid(), type: 'lead', content: 'The hour after a storm is unlike any other. The city empties of people but fills with light — reflections in standing water, steam rising from pavement, the particular blue of a sky that has just finished raining.' },
      { id: uid(), type: 'photo-full', src: 'https://picsum.photos/seed/tpl_pe_01/1600/900', caption: 'East 9th Street, 6:12 a.m., April 2026.' },
      { id: uid(), type: 'text', content: 'These photographs were made across three mornings following heavy rainfall in April. Each time, I arrived before the streets filled again — before the delivery trucks and the commuters and the coffee shops pulled their gates. I wanted the city at its most candid.' },
      { id: uid(), type: 'photo-pair', src1: 'https://picsum.photos/seed/tpl_pe_02/800/1000', src2: 'https://picsum.photos/seed/tpl_pe_03/800/1000', caption: 'Left: Prospect Ave overpass. Right: Market District, looking north.' },
      { id: uid(), type: 'pullquote', content: 'Every city has a version of itself it only shows for an hour.' },
      { id: uid(), type: 'photo-full', src: 'https://picsum.photos/seed/tpl_pe_04/1600/900', caption: 'Cuyahoga River, eastern bank, 6:48 a.m.' },
      { id: uid(), type: 'text', content: 'By seven o\'clock the light changes and the city belongs to everyone again. But for a short window each morning, if you\'re willing to get wet, it\'s entirely yours.' },
    ],
  },
  {
    name: 'Exhibition Review',
    description: 'Critical write-up with a featured image and quoted source',
    blocks: () => [
      { id: uid(), type: 'lead', content: 'Decisive Moments, the new group exhibition at the Folger Gallery, takes its title from Cartier-Bresson but its spirit from somewhere more uncomfortable. These are not photographs of elegant convergence. They are photographs of friction — of things almost happening, of gestures caught between intention and consequence.' },
      { id: uid(), type: 'image', src: 'https://picsum.photos/seed/tpl_er_hero/1200/750', caption: 'Installation view, Decisive Moments, Folger Gallery. Through July 26, 2026.', breakout: true },
      { id: uid(), type: 'text', content: 'The show gathers work from eleven photographers across four decades, ranging from large-format documentary to contemporary street work shot on phones. The curatorial logic is not chronological or geographic but emotional: each piece is hung in relation to a kind of tension, a quality of the unresolved.' },
      { id: uid(), type: 'text', content: 'The strongest work in the show belongs to Danielle Park, whose series Along the Margin documents life on the fringes of suburban development. Her images have a quality of just-missed-ness that is almost painful — a child frozen mid-laugh, a fence casting a shadow on ground that will be a parking lot by next year.' },
      { id: uid(), type: 'blockquote', content: 'I\'m not interested in the moment itself. I\'m interested in what a moment reveals about the time surrounding it — the past it carries and the future it can\'t see coming.', cite: '— Danielle Park, artist statement' },
      { id: uid(), type: 'subheading', content: 'Where the Exhibition Struggles' },
      { id: uid(), type: 'text', content: 'Not every inclusion earns its place. A handful of the newer works feel conceptually adjacent rather than genuinely related — included, one suspects, for variety rather than necessity. The exhibition would be tighter and more powerful at two-thirds its current size.' },
      { id: uid(), type: 'inset', content: 'Decisive Moments runs through July 26 at the Folger Gallery, 1240 Superior Ave. Open Tuesday–Sunday, 11 a.m.–6 p.m. Admission is free for CU students with valid ID.' },
      { id: uid(), type: 'divider' },
      { id: uid(), type: 'text', content: 'Quibbles aside, Decisive Moments is the most coherent group show the Folger has mounted in years. It takes a real argument seriously and pursues it with enough confidence to occasionally be wrong, which is more than can be said for most institutional photography exhibitions.' },
    ],
  },
  {
    name: 'Event Recap',
    description: 'Two-photo opener, recap body, and a highlight callout',
    blocks: () => [
      { id: uid(), type: 'lead', content: 'Forty-two members showed up to Riverside Park on Saturday, which surprised everyone including the organizers. The golden hour delivered. So did the backup pizza plan when the food truck didn\'t.' },
      { id: uid(), type: 'photo-pair', src1: 'https://picsum.photos/seed/tpl_ev_01/900/700', src2: 'https://picsum.photos/seed/tpl_ev_02/900/700', caption: 'Members shooting along the east bank. Photos by Jordan Kim.' },
      { id: uid(), type: 'text', content: 'The Spring Riverside Shoot has become one of the club\'s most reliable annual events, partly because the location is genuinely excellent and partly because it\'s become a tradition for newer members to attend their first club outing here. This year felt notably energetic — a mix of first-timers with entry-level DSLRs and veterans hauling medium format, all sharing the same patch of riverbank.' },
      { id: uid(), type: 'text', content: 'Workshop-style pairings ran in the first hour, with experienced members working alongside newer ones on metering for high-contrast light. Several people mentioned it was the first time they\'d fully understood how to expose for shadows without blowing the sky — the kind of thing that sounds obvious in a YouTube tutorial and becomes real when you\'re standing next to someone who knows it by instinct.' },
      { id: uid(), type: 'inset', content: 'Next shoot: Sunday, July 13 — Night Photography at the West Side Market. Meet at 9 p.m. at the Ontario Street entrance. Bring a tripod and a fully charged battery.' },
      { id: uid(), type: 'image', src: 'https://picsum.photos/seed/tpl_ev_03/1200/750', caption: 'The group at golden hour, looking west. Photo by Priya Nair.' },
      { id: uid(), type: 'text', content: 'Member photos from the shoot are now in the shared Google Drive folder linked in the Discord. Best shots will be featured in the end-of-semester showcase — submit yours by June 30.' },
    ],
  },
]

const showTemplates = ref(false)

function loadTemplate(tpl: Template) {
  const hasContent = form.blocks.some(b => {
    const a = b as any
    return a.content || a.question || a.answer || a.src || a.src1
  })
  if (hasContent && !confirm(`Replace current blocks with the "${tpl.name}" template?`)) return
  form.blocks = tpl.blocks()
  showTemplates.value = false
  paletteOpen.value = false
}

// ─── Preview ─────────────────────────────────────────────────────────────────

const preview = ref(false)

// ─── Submit ──────────────────────────────────────────────────────────────────

function onSubmit() {
  emit('submit', structuredClone(toRaw(form)))
}
</script>

<template>
  <form class="editor" @submit.prevent="onSubmit">

    <!-- Save bar -->
    <div class="editor__bar">
      <NuxtLink :to="localePath('/admin/posts')" class="btn-ghost">{{ t('admin.cancel') }}</NuxtLink>
      <button type="button" class="btn-tpl" :class="{ 'btn-tpl--active': showTemplates }" @click="showTemplates = !showTemplates; preview = false">
        Templates
      </button>
      <button type="button" class="btn-toggle" :class="{ 'btn-toggle--active': preview }" @click="preview = !preview; showTemplates = false">
        {{ preview ? 'Edit' : 'Preview' }}
      </button>
      <button type="submit" class="btn-solid" :disabled="busy">
        {{ busy ? t('admin.saving') : (submitLabel || t('admin.save')) }}
      </button>
    </div>

    <!-- Template picker -->
    <div v-if="showTemplates" class="tpl-picker">
      <p class="tpl-picker__hint">Choose a starting structure. Existing blocks will be replaced.</p>
      <div class="tpl-grid">
        <button
          v-for="tpl in TEMPLATES"
          :key="tpl.name"
          type="button"
          class="tpl-card"
          @click="loadTemplate(tpl)"
        >
          <span class="tpl-card__name">{{ tpl.name }}</span>
          <span class="tpl-card__desc">{{ tpl.description }}</span>
          <span class="tpl-card__blocks">{{ tpl.blocks().length }} blocks</span>
        </button>
      </div>
    </div>

    <!-- Metadata dock -->
    <div v-if="!preview" class="top-dock">
      <div class="dock-fields">
        <div class="field field--span2">
          <label>Title</label>
          <textarea v-model="form.title" rows="2" :placeholder="t('adminPostForm.titlePlaceholder')" />
        </div>
        <div class="field">
          <label>{{ t('adminPostForm.tag') }}</label>
          <input v-model="form.tag" type="text" :placeholder="t('adminPostForm.tagPlaceholder')">
        </div>
        <div class="field">
          <label>{{ t('adminForm.dateDisplay') }}</label>
          <input v-model="form.date" type="text" :placeholder="t('adminForm.datePlaceholder')">
        </div>
        <div class="field">
          <label>{{ t('adminForm.publishedSort') }}</label>
          <input v-model="form.published" type="date">
        </div>
        <div class="field field--span3 field--visibility">
          <label>Visibility</label>
          <div class="visibility-toggle" role="radiogroup" aria-label="Post visibility">
            <button
              v-for="option in VISIBILITY_OPTIONS"
              :key="option.value"
              type="button"
              class="visibility-toggle__option"
              :class="{ active: form.visibility === option.value }"
              :aria-checked="form.visibility === option.value"
              role="radio"
              @click="form.visibility = option.value"
            >
              <span>{{ option.label }}</span>
              <small>{{ option.description }}</small>
            </button>
          </div>
        </div>
        <div class="field field--span3">
          <label>{{ t('adminPostForm.excerptPlaceholder') }}</label>
          <textarea v-model="form.excerpt" rows="2" :placeholder="t('adminPostForm.excerptPlaceholder')" />
        </div>
        <div class="field field--span3">
          <label>{{ t('adminPostForm.image') }}</label>
          <input v-model="form.image" type="text" :placeholder="t('adminPostForm.imagePlaceholder')">
        </div>
        <div class="field">
          <label>Hero Style</label>
          <select v-model="form.heroStyle">
            <option v-for="s in HERO_STYLES" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div class="field field--span2">
          <label>Author</label>
          <input v-model="form.author" type="text" placeholder="e.g. Ananda K.">
        </div>
        <div class="field field--span2">
          <label>Author Bio</label>
          <textarea v-model="form.authorBio" rows="2" placeholder="Short bio shown below the article..." />
        </div>
        <div class="field">
          <label>Author Avatar URL</label>
          <input v-model="form.authorAvatar" type="text" placeholder="https://...">
        </div>
      </div>
    </div>

    <!-- Block canvas -->
    <div v-if="!preview" class="block-canvas">

      <div
        v-for="(block, i) in form.blocks"
        :key="block.id"
        class="block-row"
        :class="{ 'block-row--dragging': dragFrom === i, 'block-row--over': dragOver === i && dragFrom !== i }"
        draggable="true"
        @dragstart="onDragStart(i)"
        @dragover.prevent="onDragOver(i)"
        @drop.prevent="onDrop(i)"
        @dragend="onDragEnd"
      >
        <div class="block-row__handle" title="Drag to reorder">⠿</div>
        <div class="block-row__badge">{{ BLOCK_LABEL[block.type] }}</div>

        <div class="block-row__fields">

          <!-- text, lead, pullquote, inset -->
          <textarea
            v-if="block.type === 'text' || block.type === 'lead' || block.type === 'pullquote' || block.type === 'inset'"
            :value="(block as any).content"
            rows="3"
            :class="['field-ta', `field-ta--${block.type}`]"
            :placeholder="block.type === 'lead' ? 'Opening lead paragraph...' : block.type === 'pullquote' ? 'Pull quote text...' : block.type === 'inset' ? 'Callout / sidebar text...' : 'Paragraph text...'"
            @input="(block as any).content = ($event.target as HTMLTextAreaElement).value"
          />

          <!-- heading, subheading -->
          <input
            v-else-if="block.type === 'heading' || block.type === 'subheading'"
            :value="(block as any).content"
            type="text"
            :class="['field-in', `field-in--${block.type}`]"
            :placeholder="block.type === 'heading' ? 'Section heading...' : 'Sub-section heading...'"
            @input="(block as any).content = ($event.target as HTMLInputElement).value"
          />

          <!-- blockquote -->
          <template v-else-if="block.type === 'blockquote'">
            <textarea
              :value="(block as any).content"
              rows="3"
              class="field-ta field-ta--blockquote"
              placeholder="Quote text..."
              @input="(block as any).content = ($event.target as HTMLTextAreaElement).value"
            />
            <input
              :value="(block as any).cite"
              type="text"
              class="field-in field-in--cite"
              placeholder="— Attribution (optional)"
              @input="(block as any).cite = ($event.target as HTMLInputElement).value"
            />
          </template>

          <!-- image -->
          <template v-else-if="block.type === 'image'">
            <input :value="(block as any).src"     type="text" class="field-in field-in--url" placeholder="Image URL" @input="(block as any).src = ($event.target as HTMLInputElement).value" />
            <input :value="(block as any).caption" type="text" class="field-in field-in--cap" placeholder="Caption (optional)" @input="(block as any).caption = ($event.target as HTMLInputElement).value" />
            <label class="field-check">
              <input type="checkbox" :checked="(block as any).breakout" @change="(block as any).breakout = ($event.target as HTMLInputElement).checked" />
              Breakout (wider than column)
            </label>
          </template>

          <!-- photo-full -->
          <template v-else-if="block.type === 'photo-full'">
            <input :value="(block as any).src"     type="text" class="field-in field-in--url" placeholder="Photo URL" @input="(block as any).src = ($event.target as HTMLInputElement).value" />
            <input :value="(block as any).caption" type="text" class="field-in field-in--cap" placeholder="Caption (optional)" @input="(block as any).caption = ($event.target as HTMLInputElement).value" />
          </template>

          <!-- photo-pair -->
          <template v-else-if="block.type === 'photo-pair'">
            <div class="field-pair">
              <input :value="(block as any).src1" type="text" class="field-in field-in--url" placeholder="Left photo URL" @input="(block as any).src1 = ($event.target as HTMLInputElement).value" />
              <input :value="(block as any).src2" type="text" class="field-in field-in--url" placeholder="Right photo URL" @input="(block as any).src2 = ($event.target as HTMLInputElement).value" />
            </div>
            <input :value="(block as any).caption" type="text" class="field-in field-in--cap" placeholder="Shared caption (optional)" @input="(block as any).caption = ($event.target as HTMLInputElement).value" />
          </template>

          <!-- divider -->
          <div v-else-if="block.type === 'divider'" class="field-divider">· · ·</div>

          <!-- qanda -->
          <template v-else-if="block.type === 'qanda'">
            <textarea :value="(block as any).question" rows="2" class="field-ta field-ta--q" placeholder="Question..." @input="(block as any).question = ($event.target as HTMLTextAreaElement).value" />
            <textarea :value="(block as any).answer"   rows="3" class="field-ta field-ta--a" placeholder="Answer..."   @input="(block as any).answer   = ($event.target as HTMLTextAreaElement).value" />
          </template>

        </div>

        <!-- Ops -->
        <div class="block-row__ops">
          <button type="button" class="op-btn" title="Insert block after" @click.stop="openPalette(i)">+</button>
          <button type="button" class="op-btn op-btn--del" title="Remove block" @click="removeBlock(i)">×</button>
        </div>

      </div>

      <!-- Add block zone -->
      <div class="add-zone">
        <button type="button" class="add-btn" @click.stop="openPalette(null)">
          + Add Block
        </button>
      </div>

    </div>

    <!-- Preview pane — 1:1 reproduction of /posts/[slug] -->
    <div v-if="preview" class="preview-shell" :style="form.heroStyle === 'minimal-dark' ? 'background:#0C0C0A;color:#F5F4F0' : ''">
      <article :class="['post', `post--${form.heroStyle ?? 'standard'}`]">

        <!-- Standard hero -->
        <template v-if="(form.heroStyle ?? 'standard') === 'standard'">
          <header class="std-head">
            <p class="std-head__eyebrow">{{ form.tag }} · {{ form.date }}</p>
            <h1 class="std-head__title">{{ form.title || 'Untitled' }}</h1>
            <p v-if="form.excerpt" class="std-head__excerpt">{{ form.excerpt }}</p>
            <p v-if="form.author" class="std-head__author">{{ form.author }}</p>
          </header>
          <div v-if="form.image" class="std-hero">
            <img :src="form.image" :alt="form.title">
          </div>
        </template>

        <!-- Dark full-bleed hero -->
        <header v-else-if="form.heroStyle === 'dark-full'" class="df-head">
          <div class="df-head__bg">
            <img v-if="form.image" :src="form.image" :alt="form.title">
          </div>
          <div class="df-head__gradient" />
          <div class="df-head__inner">
            <p class="df-head__tag">{{ form.tag }}</p>
            <h1 class="df-head__title">{{ form.title || 'Untitled' }}</h1>
            <div class="df-head__meta">
              <span v-if="form.author" class="df-head__author">{{ form.author }}</span>
              <span v-if="form.author" class="df-head__sep" />
              <span>{{ form.date }}</span>
            </div>
          </div>
        </header>

        <!-- Split hero -->
        <header v-else-if="form.heroStyle === 'split'" class="sp-head">
          <div class="sp-head__img">
            <img v-if="form.image" :src="form.image" :alt="form.title">
          </div>
          <div class="sp-head__content">
            <p class="sp-head__tag">{{ form.tag }}</p>
            <h1 class="sp-head__title">{{ form.title || 'Untitled' }}</h1>
            <p v-if="form.excerpt" class="sp-head__excerpt">{{ form.excerpt }}</p>
            <div class="sp-head__meta">
              <span v-if="form.author" class="sp-head__author">{{ form.author }}</span>
              <span v-if="form.author" class="sp-head__sep" />
              <span>{{ form.date }}</span>
            </div>
          </div>
        </header>

        <!-- Minimal dark header -->
        <header v-else-if="form.heroStyle === 'minimal-dark'" class="md-head">
          <p class="md-head__tag">{{ form.tag }}</p>
          <h1 class="md-head__title">{{ form.title || 'Untitled' }}</h1>
          <p v-if="form.excerpt" class="md-head__sub">{{ form.excerpt }}</p>
          <div class="md-head__meta">
            <span v-if="form.author" class="md-head__author">{{ form.author }}</span>
            <span v-if="form.author" class="md-head__sep" />
            <span>{{ form.date }}</span>
          </div>
        </header>

        <!-- Body -->
        <div class="post__body">
          <template v-for="block in form.blocks" :key="block.id">
            <p v-if="block.type === 'text'" class="pb-text">{{ (block as any).content }}</p>
            <p v-else-if="block.type === 'lead'" class="pb-lead">{{ (block as any).content }}</p>
            <h2 v-else-if="block.type === 'heading'" class="pb-heading">{{ (block as any).content }}</h2>
            <h3 v-else-if="block.type === 'subheading'" class="pb-subheading">{{ (block as any).content }}</h3>
            <div v-else-if="block.type === 'pullquote'" class="pb-pullquote">{{ (block as any).content }}</div>
            <blockquote v-else-if="block.type === 'blockquote'" class="pb-blockquote">
              <span>{{ (block as any).content }}</span>
              <cite v-if="(block as any).cite">{{ (block as any).cite }}</cite>
            </blockquote>
            <figure v-else-if="block.type === 'image'" class="pb-image" :class="{ 'pb-image--breakout': (block as any).breakout }">
              <img :src="(block as any).src" :alt="(block as any).caption || ''">
              <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
            </figure>
            <figure v-else-if="block.type === 'photo-full'" class="pb-photo-full">
              <img :src="(block as any).src" :alt="(block as any).caption || ''">
              <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
            </figure>
            <figure v-else-if="block.type === 'photo-pair'" class="pb-photo-pair">
              <img :src="(block as any).src1" alt="">
              <img :src="(block as any).src2" alt="">
              <figcaption v-if="(block as any).caption" class="pb-photo-pair__cap">{{ (block as any).caption }}</figcaption>
            </figure>
            <div v-else-if="block.type === 'divider'" class="pb-divider">· · ·</div>
            <div v-else-if="block.type === 'inset'" class="pb-inset">{{ (block as any).content }}</div>
            <div v-else-if="block.type === 'qanda'" class="pb-qanda">
              <div class="pb-qanda__q">{{ (block as any).question }}</div>
              <div class="pb-qanda__a">{{ (block as any).answer }}</div>
            </div>
          </template>

          <!-- Article footer -->
          <div class="post__footer">
            <div class="post__tags">
              <span class="post__tag-pill">{{ form.tag }}</span>
            </div>
            <button type="button" class="post__share">Share →</button>
          </div>
        </div>

        <!-- Author bio -->
        <div v-if="form.author" class="author-bio">
          <div class="author-bio__inner">
            <div class="author-bio__avatar">
              <img v-if="form.authorAvatar" :src="form.authorAvatar" :alt="form.author">
              <span v-else class="author-bio__initials">{{ form.author.charAt(0) }}</span>
            </div>
            <div>
              <p class="author-bio__name">{{ form.author }}</p>
              <p v-if="form.authorBio" class="author-bio__text">{{ form.authorBio }}</p>
            </div>
          </div>
        </div>

      </article>
    </div>

    <!-- Block picker modal -->
    <Teleport to="body">
      <div v-if="paletteOpen" class="bpm-overlay" @click.self="paletteOpen = false">
        <div class="bpm-panel" role="dialog" aria-modal="true" aria-label="Add a block">

          <div class="bpm-header">
            <span class="bpm-title">Add a Block</span>
            <button type="button" class="bpm-close" @click="paletteOpen = false">✕</button>
          </div>

          <div class="bpm-body">
            <div v-for="group in ['Text', 'Visual']" :key="group" class="bpm-group">
              <div class="bpm-group-label">{{ group }}</div>
              <div class="bpm-grid">
                <button
                  v-for="item in PALETTE.filter(p => p.group === group)"
                  :key="item.type"
                  type="button"
                  class="bpm-card"
                  @click="addBlock(item.type)"
                >
                  <div class="bpm-preview">

                    <template v-if="item.type === 'text'">
                      <div class="bpv-lines">
                        <div class="bpv-l l-full" /><div class="bpv-l l-3q" />
                        <div class="bpv-l l-full" /><div class="bpv-l l-half" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'lead'">
                      <div class="bpv-lead-wrap">
                        <div class="bpv-l l-full" /><div class="bpv-l l-3q" /><div class="bpv-l l-half" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'heading'">
                      <div class="bpv-heading">Section<br>Heading</div>
                    </template>

                    <template v-else-if="item.type === 'subheading'">
                      <div class="bpv-subheading">Subsection heading</div>
                      <div class="bpv-lines" style="margin-top:8px">
                        <div class="bpv-l l-full" /><div class="bpv-l l-3q" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'pullquote'">
                      <div class="bpv-pullquote">"A memorable phrase worth highlighting."</div>
                    </template>

                    <template v-else-if="item.type === 'blockquote'">
                      <div class="bpv-blockquote">
                        <div class="bpv-l l-full bpv-bq-line" />
                        <div class="bpv-l l-3q bpv-bq-line" />
                        <div class="bpv-l l-quarter bpv-bq-cite" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'inset'">
                      <div class="bpv-inset">
                        <div class="bpv-l l-full" /><div class="bpv-l l-3q" /><div class="bpv-l l-half" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'qanda'">
                      <div class="bpv-qanda">
                        <div class="bpv-qa-row"><span class="bpv-qa-badge bpv-qa-q">Q</span><div class="bpv-l l-3q" /></div>
                        <div class="bpv-qa-row"><span class="bpv-qa-badge bpv-qa-a">A</span><div class="bpv-l l-full" /></div>
                        <div class="bpv-qa-row"><span class="bpv-qa-badge bpv-qa-a" style="opacity:0" /><div class="bpv-l l-half" /></div>
                      </div>
                    </template>

                    <template v-else-if="item.type === 'image'">
                      <div class="bpv-image">
                        <div class="bpv-img-rect" />
                        <div class="bpv-l l-3q bpv-cap" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'photo-full'">
                      <div class="bpv-photo-full" />
                    </template>

                    <template v-else-if="item.type === 'photo-pair'">
                      <div class="bpv-photo-pair">
                        <div class="bpv-img-rect" /><div class="bpv-img-rect" />
                      </div>
                    </template>

                    <template v-else-if="item.type === 'divider'">
                      <div class="bpv-divider">· · ·</div>
                    </template>

                  </div>
                  <div class="bpm-card-info">
                    <span class="bpm-card-name">{{ item.label }}</span>
                    <span class="bpm-card-desc">{{ (item as any).description }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </Teleport>

  </form>
</template>

<style scoped>
/* ─── Layout ─────────────────────────────────────────────────────────────── */
.editor { display: flex; flex-direction: column; gap: 0; }
.editor__bar {
  display: flex; justify-content: flex-end; gap: 0.75rem;
  padding: 0.85rem 0; border-bottom: 1px solid var(--subtle); margin-bottom: 1.75rem;
}

/* ─── Metadata dock ──────────────────────────────────────────────────────── */
.top-dock {
  border: 1px solid var(--subtle); background: var(--body-bg);
  padding: 1.25rem 1.5rem; margin-bottom: 2rem;
}
.dock-fields {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
}
.field { display: flex; flex-direction: column; gap: 0.3rem; }
.field--span2 { grid-column: span 2; }
.field--span3 { grid-column: span 3; }
.field label { font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
.field input,
.field select,
.field textarea {
  border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.82rem; padding: 0.52rem 0.65rem;
  outline: none; width: 100%;
}
.field textarea { resize: vertical; line-height: 1.65; }
.field input:focus,
.field select:focus,
.field textarea:focus { border-color: var(--accent); }

.visibility-toggle {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid var(--subtle);
  background: #fff;
}
.visibility-toggle__option {
  min-width: 0;
  border: 0;
  border-left: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  padding: 0.72rem 0.75rem;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.visibility-toggle__option:first-child { border-left: 0; }
.visibility-toggle__option span {
  display: block;
  margin-bottom: 0.3rem;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  line-height: 1.2;
  text-transform: uppercase;
}
.visibility-toggle__option small {
  display: block;
  color: inherit;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  line-height: 1.45;
}
.visibility-toggle__option.active {
  background: var(--dark);
  color: rgba(245, 244, 240, 0.68);
}
.visibility-toggle__option.active span { color: var(--accent); }

/* ─── Block canvas ───────────────────────────────────────────────────────── */
.block-canvas { display: flex; flex-direction: column; }

/* ─── Block row ──────────────────────────────────────────────────────────── */
.block-row {
  display: grid;
  grid-template-columns: 22px 88px 1fr auto;
  grid-template-rows: auto auto;
  column-gap: 0.9rem;
  padding: 1rem 0;
  border-top: 1px solid var(--subtle);
  position: relative;
  transition: background 0.12s;
}
.block-row--dragging { opacity: 0.35; cursor: grabbing; }
.block-row--over { background: var(--paper); }

.block-row__handle {
  font-size: 1.05rem; color: var(--subtle); cursor: grab;
  user-select: none; padding-top: 0.3rem; text-align: center;
  transition: color 0.15s;
}
.block-row:hover .block-row__handle { color: var(--muted); }
.block-row__handle:active { cursor: grabbing; }

.block-row__badge {
  font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent); padding-top: 0.42rem; white-space: nowrap;
}

.block-row__fields { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; }


/* ─── Field inputs inside block rows ────────────────────────────────────── */
.field-ta,
.field-in {
  width: 100%;
  border: 0;
  border-bottom: 1px solid var(--subtle);
  background: transparent;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.88rem;
  line-height: 1.8;
  padding: 0.25rem 0;
  outline: none;
}
.field-ta { resize: vertical; }
.field-ta:focus,
.field-in:focus { border-bottom-color: var(--accent); }

/* Type-specific aesthetics */
.field-ta--lead    { font-family: var(--font-serif); font-size: 1rem; }
.field-ta--pullquote { font-family: var(--font-serif); font-style: italic; color: var(--accent); }
.field-ta--blockquote { font-style: italic; }
.field-ta--q       { font-weight: 500; }
.field-in--heading    { font-family: var(--font-serif); font-size: 1.25rem; font-weight: 300; }
.field-in--subheading { font-family: var(--font-serif); font-size: 1.05rem; }
.field-in--cite    { font-size: 0.75rem; color: var(--muted); letter-spacing: 0.06em; }
.field-in--url     { font-family: monospace; font-size: 0.75rem; color: var(--muted); }
.field-in--cap     { font-size: 0.78rem; color: var(--muted); }

.field-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.field-check {
  display: flex; align-items: center; gap: 0.45rem;
  font-size: 0.7rem; color: var(--muted); cursor: pointer; padding-top: 0.1rem;
}
.field-check input { cursor: pointer; accent-color: var(--accent); }

.field-divider {
  text-align: center; font-size: 0.85rem; color: var(--muted);
  letter-spacing: 0.5em; padding: 0.5rem 0;
}

/* ─── Block ops ──────────────────────────────────────────────────────────── */
.block-row__ops { display: flex; flex-direction: column; gap: 0.35rem; padding-top: 0.3rem; }
.op-btn {
  width: 22px; height: 22px;
  border: 1px solid var(--subtle); background: transparent;
  color: var(--muted); cursor: pointer; font-size: 0.85rem;
  display: flex; align-items: center; justify-content: center;
  transition: border-color 0.15s, color 0.15s;
}
.op-btn:hover { border-color: var(--accent); color: var(--accent); }
.op-btn--del:hover { border-color: #c0392b; color: #c0392b; }

/* ─── Add block zone ─────────────────────────────────────────────────────── */
.add-zone {
  border-top: 1px solid var(--subtle);
  padding-top: 1rem;
  display: flex; flex-direction: column; gap: 0;
}
.add-btn {
  background: transparent; border: 1px dashed var(--subtle);
  color: var(--muted); font-family: var(--font-sans);
  font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase;
  padding: 0.8rem; cursor: pointer; width: 100%;
  transition: border-color 0.2s, color 0.2s;
}
.add-btn:hover { border-color: var(--accent); color: var(--accent); }

/* ─── Buttons ────────────────────────────────────────────────────────────── */
.btn-ghost, .btn-solid, .btn-toggle, .btn-tpl {
  font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.18em;
  text-transform: uppercase; padding: 0.7rem 1.1rem; cursor: pointer; text-decoration: none;
}
.btn-ghost { border: 1px solid var(--subtle); background: none; color: var(--dark); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-solid { background: var(--dark); color: #F5F4F0; border: none; }
.btn-solid:hover:not(:disabled) { background: var(--accent); }
.btn-solid:disabled { opacity: 0.6; cursor: default; }
.btn-toggle { border: 1px solid var(--subtle); background: none; color: var(--muted); margin-right: auto; }
.btn-toggle:hover { border-color: var(--accent); color: var(--accent); }
.btn-toggle--active { border-color: var(--accent); color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.btn-tpl { border: 1px solid var(--subtle); background: none; color: var(--muted); }
.btn-tpl:hover { border-color: var(--accent); color: var(--accent); }
.btn-tpl--active { border-color: var(--accent); color: var(--accent); }

/* ─── Template picker ────────────────────────────────────────────────────── */
.tpl-picker {
  background: var(--dark); padding: 1.5rem 1.75rem; margin-bottom: 1.75rem;
}
.tpl-picker__hint {
  font-family: var(--font-sans); font-size: 0.72rem;
  color: rgba(245,244,240,0.35); margin-bottom: 1rem;
}
.tpl-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem;
}
.tpl-card {
  display: flex; flex-direction: column; gap: 0.35rem; text-align: left;
  font-family: var(--font-sans); font-size: 1rem;
  border: 1px solid rgba(245,244,240,0.12); background: transparent;
  padding: 0.9rem 1rem; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.tpl-card:hover { border-color: var(--accent); background: rgba(245,244,240,0.04); }
.tpl-card__name {
  font-family: var(--font-serif); font-size: 0.95rem; font-weight: 300;
  color: rgba(245,244,240,0.9); line-height: 1.2;
}
.tpl-card__desc {
  font-size: 0.75rem; color: rgba(245,244,240,0.45); line-height: 1.55;
}
.tpl-card__blocks {
  font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--accent); margin-top: 0.2rem;
}

/* ─── Preview shell ──────────────────────────────────────────────────────── */
.preview-shell { margin: 0 -2rem; overflow: visible; }

/* ─── Post shell ─────────────────────────────────────────────────────────── */
.post { overflow: visible; }

/* ─── Standard hero ──────────────────────────────────────────────────────── */
.std-head {
  max-width: 760px; margin: 0 auto; padding: 4rem 3rem 2rem;
}
.std-head__eyebrow {
  font-size: 0.56rem; letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 1.25rem;
}
.std-head__title {
  font-family: var(--font-serif); font-size: clamp(2.2rem, 4.5vw, 3.8rem);
  font-weight: 200; line-height: 1.05; letter-spacing: -0.025em; margin-bottom: 1.5rem; white-space: pre-line;
}
.std-head__excerpt { font-size: 0.95rem; color: var(--muted); line-height: 1.8; margin-bottom: 1rem; }
.std-head__author {
  font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent);
}
.std-hero { max-width: 760px; margin: 0 auto; padding: 0 3rem 3rem; }
.std-hero img { width: 100%; height: auto; display: block; max-height: 560px; object-fit: cover; }

/* ─── Dark full-bleed hero ───────────────────────────────────────────────── */
.df-head {
  position: relative; min-height: 72svh; background: #0C0C0A;
  display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
}
.df-head__bg { position: absolute; inset: 0; }
.df-head__bg img { width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.4; }
.df-head__gradient {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(12,12,10,0.4) 0%, rgba(12,12,10,0.05) 35%, rgba(12,12,10,0.92) 100%);
}
.df-head__inner { position: relative; z-index: 2; max-width: 900px; margin: 0 auto; width: 100%; padding: 0 3rem 3.5rem; }
.df-head__tag { font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); margin-bottom: 1.25rem; }
.df-head__title {
  font-family: var(--font-serif); font-size: clamp(3rem, 6.5vw, 5.5rem);
  font-weight: 200; line-height: 0.93; letter-spacing: -0.03em; color: #F5F4F0; margin-bottom: 2rem; max-width: 800px; white-space: pre-line;
}
.df-head__meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.45); }
.df-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.df-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.3); }

/* ─── Split hero ─────────────────────────────────────────────────────────── */
.sp-head { display: grid; grid-template-columns: 1fr 1fr; min-height: 100svh; background: #0C0C0A; }
.sp-head__img { position: relative; overflow: hidden; }
.sp-head__img img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; }
.sp-head__img::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(12,12,10,0.5), transparent 55%);
}
.sp-head__content { padding: 8rem 4rem 4rem; display: flex; flex-direction: column; justify-content: flex-end; color: #F5F4F0; }
.sp-head__tag { font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; }
.sp-head__title { font-family: var(--font-serif); font-size: clamp(2.5rem, 5vw, 4.5rem); font-weight: 200; line-height: 0.95; letter-spacing: -0.03em; margin-bottom: 1.5rem; white-space: pre-line; }
.sp-head__excerpt { font-size: 0.85rem; line-height: 1.85; color: rgba(245,244,240,0.55); max-width: 440px; margin-bottom: 2rem; }
.sp-head__meta { display: flex; align-items: center; gap: 0.75rem; font-size: 0.56rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.4); }
.sp-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.sp-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.25); }

/* ─── Minimal dark header ────────────────────────────────────────────────── */
.md-head { text-align: center; padding: 10rem 3rem 6rem; max-width: 720px; margin: 0 auto; }
.md-head__tag { font-size: 0.52rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); margin-bottom: 1.25rem; }
.md-head__title {
  font-family: var(--font-serif); font-size: clamp(3rem, 6vw, 5rem);
  font-weight: 200; line-height: 0.92; letter-spacing: -0.03em; color: #F5F4F0; margin-bottom: 1.25rem; white-space: pre-line;
}
.md-head__sub { font-size: 0.95rem; color: rgba(245,244,240,0.45); line-height: 1.8; max-width: 520px; margin: 0 auto 2rem; }
.md-head__meta { display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-size: 0.56rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.35); }
.md-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.md-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.2); }

/* ─── Body ───────────────────────────────────────────────────────────────── */
.post__body { max-width: 760px; margin: 0 auto; padding: 3rem 3rem 4rem; display: flex; flex-direction: column; overflow: visible; }

/* ─── Block: Paragraph ───────────────────────────────────────────────────── */
.pb-text { font-size: 1rem; line-height: 1.95; color: var(--dark); margin-bottom: 1.5rem; }

/* ─── Block: Lead ────────────────────────────────────────────────────────── */
.pb-lead { font-family: var(--font-serif); font-size: 1.15rem; font-weight: 400; line-height: 1.7; color: var(--dark); margin-bottom: 2.5rem; padding-left: 1.5rem; border-left: 2px solid var(--accent); }

/* ─── Block: Heading ─────────────────────────────────────────────────────── */
.pb-heading { font-family: var(--font-serif); font-size: 1.8rem; font-weight: 300; line-height: 1.15; letter-spacing: -0.02em; margin: 3.5rem 0 1.25rem; }

/* ─── Block: Subheading ──────────────────────────────────────────────────── */
.pb-subheading { font-family: var(--font-serif); font-size: 1.3rem; font-weight: 400; line-height: 1.2; margin: 2.5rem 0 1rem; }

/* ─── Block: Pull quote ──────────────────────────────────────────────────── */
.pb-pullquote { font-family: var(--font-serif); font-size: 1.9rem; font-weight: 200; font-style: italic; line-height: 1.25; color: var(--accent); margin: 3rem 0; padding: 0 0 0 2.5rem; border-left: 2px solid var(--accent); }
.post--minimal-dark .pb-pullquote { border-left: none; padding-left: 0; text-align: center; }

/* ─── Block: Blockquote ──────────────────────────────────────────────────── */
.pb-blockquote { font-family: var(--font-serif); font-size: 1.4rem; font-weight: 200; font-style: italic; line-height: 1.45; margin: 2.5rem 0; padding: 1.5rem 2rem; border-left: 2px solid var(--accent); background: var(--paper); display: flex; flex-direction: column; gap: 0.75rem; }
.pb-blockquote cite { font-size: 0.7rem; font-style: normal; letter-spacing: 0.12em; color: var(--muted); }

/* ─── Block: Image ───────────────────────────────────────────────────────── */
.pb-image { margin: 3rem 0; }
.pb-image--breakout { margin: 3rem -4rem; }
.pb-image img { width: 100%; display: block; }
.pb-image figcaption { font-size: 0.62rem; color: var(--muted); letter-spacing: 0.08em; padding: 0.75rem 0 0; text-align: right; }

/* ─── Block: Full-bleed photo ────────────────────────────────────────────── */
.pb-photo-full { margin: 5rem calc(-50vw + 50%); width: 100vw; }
.pb-photo-full img { width: 100%; height: 90vh; object-fit: cover; display: block; }
.pb-photo-full figcaption { font-size: 0.58rem; color: var(--muted); letter-spacing: 0.08em; padding: 0.75rem 3rem 0; text-align: right; }

/* ─── Block: Photo pair ──────────────────────────────────────────────────── */
.pb-photo-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 5rem calc(-50vw + 50%); width: 100vw; padding: 0 3rem; }
.pb-photo-pair img { width: 100%; height: 70vh; object-fit: cover; display: block; }
.pb-photo-pair__cap { grid-column: 1 / -1; font-size: 0.58rem; color: var(--muted); letter-spacing: 0.08em; padding-top: 0.65rem; text-align: right; }

/* ─── Block: Divider ─────────────────────────────────────────────────────── */
.pb-divider { text-align: center; font-size: 0.82rem; color: var(--muted); margin: 3rem 0; letter-spacing: 0.5em; }

/* ─── Block: Inset / callout ─────────────────────────────────────────────── */
.pb-inset { font-size: 0.88rem; line-height: 1.85; color: var(--muted); background: var(--paper); padding: 1.5rem 2rem; margin: 2rem 0; border-left: 2px solid var(--accent); }

/* ─── Block: Q & A ───────────────────────────────────────────────────────── */
.pb-qanda { margin-bottom: 2.5rem; }
.pb-qanda__q { font-family: var(--font-serif); font-size: 1.05rem; font-weight: 500; line-height: 1.3; margin-bottom: 1rem; display: flex; align-items: flex-start; gap: 1rem; }
.pb-qanda__q::before { content: 'Q'; flex-shrink: 0; font-family: var(--font-sans); font-size: 0.58rem; font-weight: 500; letter-spacing: 0.1em; color: var(--accent); background: var(--paper); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--subtle); margin-top: 0.05rem; }
.pb-qanda__a { font-size: 0.92rem; line-height: 1.85; color: var(--dark); display: flex; align-items: flex-start; gap: 1rem; }
.pb-qanda__a::before { content: 'A'; flex-shrink: 0; font-family: var(--font-sans); font-size: 0.58rem; font-weight: 500; background: var(--dark); color: #F5F4F0; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; margin-top: 0.05rem; }

/* ─── Minimal dark body overrides ────────────────────────────────────────── */
.post--minimal-dark .pb-text     { color: rgba(245,244,240,0.65); }
.post--minimal-dark .pb-lead     { color: rgba(245,244,240,0.8); border-left-color: var(--accent); }
.post--minimal-dark .pb-heading  { color: #F5F4F0; }
.post--minimal-dark .pb-subheading { color: #F5F4F0; }
.post--minimal-dark .pb-blockquote { background: rgba(245,244,240,0.05); }
.post--minimal-dark .pb-blockquote cite { color: rgba(245,244,240,0.35); }
.post--minimal-dark .pb-divider  { color: rgba(245,244,240,0.15); }
.post--minimal-dark .pb-inset    { background: rgba(245,244,240,0.05); color: rgba(245,244,240,0.5); }
.post--minimal-dark .pb-qanda__q { color: rgba(245,244,240,0.9); }
.post--minimal-dark .pb-qanda__q::before { background: rgba(245,244,240,0.06); border-color: rgba(245,244,240,0.12); }
.post--minimal-dark .pb-qanda__a { color: rgba(245,244,240,0.65); }
.post--minimal-dark .pb-photo-full figcaption { color: rgba(245,244,240,0.25); }
.post--minimal-dark .pb-photo-pair__cap { color: rgba(245,244,240,0.25); }
.post--minimal-dark .pb-image figcaption { color: rgba(245,244,240,0.25); }

/* ─── Article footer ─────────────────────────────────────────────────────── */
.post__footer { margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--subtle); display: flex; justify-content: space-between; align-items: center; }
.post--minimal-dark .post__footer { border-top-color: rgba(245,244,240,0.08); }
.post__tag-pill { font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); padding: 0.35rem 0.75rem; border: 1px solid var(--subtle); display: inline-block; }
.post--minimal-dark .post__tag-pill { color: rgba(245,244,240,0.3); border-color: rgba(245,244,240,0.1); }
.post__share { font-family: var(--font-sans); font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); background: none; border: none; cursor: default; }
.post--minimal-dark .post__share { color: rgba(245,244,240,0.3); }

/* ─── Author bio ─────────────────────────────────────────────────────────── */
.author-bio { background: var(--paper); border-top: 1px solid var(--subtle); padding: 3rem; }
.post--minimal-dark .author-bio { background: rgba(245,244,240,0.04); border-top-color: rgba(245,244,240,0.08); }
.author-bio__inner { max-width: 760px; margin: 0 auto; display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: start; }
.author-bio__avatar { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; background: var(--subtle); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.author-bio__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.author-bio__initials { font-family: var(--font-serif); font-size: 1.2rem; font-weight: 300; color: var(--muted); }
.author-bio__name { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; margin-bottom: 0.4rem; }
.post--minimal-dark .author-bio__name { color: rgba(245,244,240,0.9); }
.author-bio__text { font-size: 0.8rem; color: var(--muted); line-height: 1.7; }
.post--minimal-dark .author-bio__text { color: rgba(245,244,240,0.4); }

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .dock-fields { grid-template-columns: 1fr 1fr; }
  .field--span2, .field--span3 { grid-column: span 2; }
  .block-row { grid-template-columns: 22px 72px 1fr auto; }
  .sp-head { grid-template-columns: 1fr; min-height: auto; }
  .sp-head__img { min-height: 50svh; }
  .sp-head__content { padding: 6rem 2.5rem 3rem; }
  .pb-image--breakout { margin: 2.5rem 0; }
}
@media (max-width: 620px) {
  .dock-fields { grid-template-columns: 1fr; }
  .field--span2, .field--span3 { grid-column: span 1; }
  .visibility-toggle { grid-template-columns: 1fr; }
  .visibility-toggle__option {
    border-left: 0;
    border-top: 1px solid var(--subtle);
  }
  .visibility-toggle__option:first-child { border-top: 0; }
  .block-row { grid-template-columns: 22px 1fr auto; }
  .block-row__badge { display: none; }
  .field-pair { grid-template-columns: 1fr; }
  .std-head, .post__body { padding-left: 1.5rem; padding-right: 1.5rem; }
  .std-hero { padding-left: 1.5rem; padding-right: 1.5rem; }
  .md-head { padding: 7rem 1.5rem 4rem; }
  .df-head__inner { padding: 0 1.5rem 2.5rem; }
  .pb-photo-full img { height: 60vh; }
  .pb-photo-pair { padding: 0 1.5rem; }
  .pb-photo-pair img { height: 50vh; }
  .author-bio { padding: 2rem 1.5rem; }
  .author-bio__inner { grid-template-columns: 1fr; }
  .post__footer { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>

<style>
/* ─── Block picker modal (global — inside Teleport) ─────────────────────────
   All classes are prefixed .bpm- / .bpv- to avoid collisions.           */

.bpm-overlay {
  position: fixed; inset: 0; z-index: 9000;
  background: rgba(12,12,10,0.72);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}

.bpm-panel {
  background: #1A1A18;
  width: 100%; max-width: 900px; max-height: 88vh;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
}

/* ─── Header ─────────────────────────────────────────────────────────────── */
.bpm-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 1.25rem 1.75rem;
  border-bottom: 1px solid rgba(245,244,240,0.08);
  flex-shrink: 0;
}
.bpm-title {
  font-family: var(--font-serif); font-size: 1.05rem; font-weight: 300;
  color: rgba(245,244,240,0.9); letter-spacing: -0.01em;
}
.bpm-close {
  background: none; border: none; cursor: pointer;
  color: rgba(245,244,240,0.3); font-size: 0.85rem; line-height: 1;
  padding: 0.25rem; transition: color 0.15s;
}
.bpm-close:hover { color: rgba(245,244,240,0.9); }

/* ─── Body ───────────────────────────────────────────────────────────────── */
.bpm-body {
  overflow-y: auto; padding: 1.5rem 1.75rem 2rem;
  display: flex; flex-direction: column; gap: 2rem;
}

/* ─── Group ──────────────────────────────────────────────────────────────── */
.bpm-group-label {
  font-size: 0.44rem; letter-spacing: 0.26em; text-transform: uppercase;
  color: rgba(245,244,240,0.25); margin-bottom: 0.9rem;
}
.bpm-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 0.65rem;
}

/* ─── Card ───────────────────────────────────────────────────────────────── */
.bpm-card {
  display: flex; flex-direction: column;
  background: rgba(245,244,240,0.03);
  border: 1px solid rgba(245,244,240,0.09);
  cursor: pointer; text-align: left;
  transition: border-color 0.15s, background 0.15s;
  padding: 0;
  font-family: var(--font-sans);
}
.bpm-card:hover {
  border-color: var(--accent);
  background: rgba(245,244,240,0.06);
}

/* ─── Preview area ───────────────────────────────────────────────────────── */
.bpm-preview {
  background: #F5F4F0;
  height: 88px;
  display: flex; align-items: center; justify-content: center;
  padding: 14px 16px;
  overflow: hidden;
  flex-shrink: 0;
}

/* ─── Card info ──────────────────────────────────────────────────────────── */
.bpm-card-info {
  display: flex; flex-direction: column; gap: 0.3rem;
  padding: 0.75rem 0.9rem 0.85rem;
  border-top: 1px solid rgba(245,244,240,0.08);
}
.bpm-card-name {
  font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--accent); display: block;
}
.bpm-card-desc {
  font-size: 0.72rem; color: rgba(245,244,240,0.45);
  line-height: 1.55; display: block;
}

/* ─── Preview element helpers ────────────────────────────────────────────── */

/* Generic text-bar lines */
.bpv-lines { display: flex; flex-direction: column; gap: 5px; width: 100%; }
.bpv-l { height: 4px; background: #C8C4BC; border-radius: 2px; }
.bpv-l.l-full   { width: 100%; }
.bpv-l.l-3q     { width: 75%; }
.bpv-l.l-half   { width: 50%; }
.bpv-l.l-quarter{ width: 28%; }

/* Paragraph */
/* (uses .bpv-lines directly) */

/* Lead */
.bpv-lead-wrap {
  display: flex; flex-direction: column; gap: 5px; width: 100%;
  border-left: 2.5px solid var(--accent); padding-left: 10px;
}

/* Heading */
.bpv-heading {
  font-family: var(--font-serif); font-size: 1.15rem; font-weight: 300;
  color: #1A1A18; line-height: 1.1; letter-spacing: -0.02em;
  width: 100%;
}

/* Subheading */
.bpv-subheading {
  font-family: var(--font-serif); font-size: 0.85rem; font-weight: 400;
  color: #1A1A18; width: 100%;
}

/* Pull quote */
.bpv-pullquote {
  font-family: var(--font-serif); font-size: 0.68rem; font-weight: 200;
  font-style: italic; line-height: 1.35; color: var(--accent);
  border-left: 2.5px solid var(--accent); padding-left: 10px;
  width: 100%;
}

/* Blockquote */
.bpv-blockquote {
  display: flex; flex-direction: column; gap: 5px; width: 100%;
  border-left: 2.5px solid var(--accent); padding-left: 10px;
  background: rgba(245,244,240,0.6); padding: 8px 10px;
}
.bpv-bq-line { background: #A8A49C; }
.bpv-bq-cite { background: #C8C4BC; margin-top: 3px; }

/* Callout / inset */
.bpv-inset {
  display: flex; flex-direction: column; gap: 5px; width: 100%;
  border-left: 2.5px solid var(--accent); padding: 8px 10px;
  background: rgba(200,196,188,0.35);
}

/* Q & A */
.bpv-qanda { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.bpv-qa-row { display: flex; align-items: center; gap: 7px; }
.bpv-qa-badge {
  font-family: var(--font-sans); font-size: 0.44rem; font-weight: 600;
  width: 16px; height: 16px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.bpv-qa-q {
  color: var(--accent); border: 1px solid #C8C4BC; background: #F0EDE8;
}
.bpv-qa-a { color: #F5F4F0; background: #2A2A28; }

/* Image */
.bpv-image { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.bpv-img-rect { background: #C8C4BC; border-radius: 1px; flex: 1; min-height: 44px; }
.bpv-cap { background: #D8D4CC !important; }

/* Full bleed photo */
.bpv-photo-full {
  width: calc(100% + 32px); margin: -14px -16px;
  height: 100%; background: #B8B4AC;
}

/* Photo pair */
.bpv-photo-pair {
  display: grid; grid-template-columns: 1fr 1fr; gap: 5px;
  width: 100%; height: 60px;
}

/* Divider */
.bpv-divider {
  font-family: var(--font-sans); font-size: 0.65rem; color: #A8A49C;
  letter-spacing: 0.4em; text-align: center; width: 100%;
}

@media (max-width: 640px) {
  .bpm-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
  .bpm-panel { max-height: 92vh; }
}
</style>
