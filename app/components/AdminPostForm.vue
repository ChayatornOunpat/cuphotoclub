<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { Post, PostInput, PostBlock, PostBlockType, ContentStatus, HeroStyle } from '~~/shared/types'

const props = defineProps<{
  initial?: PostInput | null
  submitLabel?: string
  busy?: boolean
  mediaPrefix?: string
}>()
const emit = defineEmits<{ submit: [value: PostInput]; 'update:title': [value: string] }>()
const { t } = useI18n()
const localePath = useLocalePath()
const router = useRouter()
const mediaPrefix = computed(() => props.mediaPrefix || 'content-posts/drafts')

// ─── Block palette ───────────────────────────────────────────────────────────

const PALETTE = [
  { type: 'text'       as PostBlockType, labelKey: 'adminPostForm.blockText',       group: 'Text',   descKey: 'adminPostForm.blockTextDesc' },
  { type: 'lead'       as PostBlockType, labelKey: 'adminPostForm.blockLead',       group: 'Text',   descKey: 'adminPostForm.blockLeadDesc' },
  { type: 'heading'    as PostBlockType, labelKey: 'adminPostForm.blockHeading',    group: 'Text',   descKey: 'adminPostForm.blockHeadingDesc' },
  { type: 'subheading' as PostBlockType, labelKey: 'adminPostForm.blockSubheading', group: 'Text',   descKey: 'adminPostForm.blockSubheadingDesc' },
  { type: 'pullquote'  as PostBlockType, labelKey: 'adminPostForm.blockPullquote',  group: 'Text',   descKey: 'adminPostForm.blockPullquoteDesc' },
  { type: 'blockquote' as PostBlockType, labelKey: 'adminPostForm.blockBlockquote', group: 'Text',   descKey: 'adminPostForm.blockBlockquoteDesc' },
  { type: 'inset'      as PostBlockType, labelKey: 'adminPostForm.blockInset',      group: 'Text',   descKey: 'adminPostForm.blockInsetDesc' },
  { type: 'qanda'      as PostBlockType, labelKey: 'adminPostForm.blockQanda',      group: 'Text',   descKey: 'adminPostForm.blockQandaDesc' },
  { type: 'image'      as PostBlockType, labelKey: 'adminPostForm.blockImage',      group: 'Visual', descKey: 'adminPostForm.blockImageDesc' },
  { type: 'photo-full' as PostBlockType, labelKey: 'adminPostForm.blockPhotoFull',  group: 'Visual', descKey: 'adminPostForm.blockPhotoFullDesc' },
  { type: 'photo-pair' as PostBlockType, labelKey: 'adminPostForm.blockPhotoPair',  group: 'Visual', descKey: 'adminPostForm.blockPhotoPairDesc' },
  { type: 'divider'    as PostBlockType, labelKey: 'adminPostForm.blockDivider',    group: 'Visual', descKey: 'adminPostForm.blockDividerDesc' },
]

const BLOCK_LABEL: Record<PostBlockType, string> = Object.fromEntries(
  PALETTE.map(p => [p.type, p.labelKey])
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

const HERO_STYLES: { value: HeroStyle; labelKey: string }[] = [
  { value: 'standard',     labelKey: 'adminPostForm.heroStandard' },
  { value: 'dark-full',    labelKey: 'adminPostForm.heroDarkFull' },
  { value: 'split',        labelKey: 'adminPostForm.heroSplit' },
  { value: 'minimal-dark', labelKey: 'adminPostForm.heroMinimalDark' },
]

const VISIBILITY_OPTIONS: { value: ContentStatus, labelKey: string, descKey: string }[] = [
  { value: 'draft', labelKey: 'adminPostForm.visDraft', descKey: 'adminPostForm.visDraftDesc' },
  { value: 'link-only', labelKey: 'adminPostForm.visLinkOnly', descKey: 'adminPostForm.visLinkOnlyDesc' },
  { value: 'public', labelKey: 'adminPostForm.visPublic', descKey: 'adminPostForm.visPublicDesc' }
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
form.heroStyle = form.heroStyle ?? 'standard'
if (!form.blocks?.length) form.blocks = [makeBlock('text')]

watch(() => form.title, val => emit('update:title', val), { immediate: true })

// ─── Live preview shape ──────────────────────────────────────────────────────
// A Post-shaped object fed to the real <PublicPostArticle> canvas. Placeholders
// keep the hero legible while empty; the real (possibly empty) values stay in
// `form` and are what get saved.
const previewPost = computed<Post>(() => ({
  id: 'preview',
  title: form.title || t('adminPostForm.untitled'),
  tag: form.tag || t('adminPostForm.tagPlaceholder'),
  date: form.date,
  published: form.published || '',
  visibility: form.visibility,
  image: form.image,
  excerpt: form.excerpt,
  heroStyle: form.heroStyle,
  author: form.author,
  authorBio: form.authorBio,
  authorAvatar: form.authorAvatar,
  blocks: form.blocks,
}))

// ─── Selection / docks ───────────────────────────────────────────────────────

type ContentField = 'title' | 'tag' | 'excerpt' | 'author' | 'image'

const selectedBlockId = ref<string | null>(null)
const dockHidden = ref(true)
const activeDock = ref<'content' | 'block'>('content')
const activeField = ref<ContentField>('title')
const canvasEl = ref<HTMLElement | null>(null)

const titleInput = ref<HTMLTextAreaElement | null>(null)
const tagInput = ref<HTMLInputElement | null>(null)
const excerptInput = ref<HTMLTextAreaElement | null>(null)
const authorInput = ref<HTMLInputElement | null>(null)

const selectedBlock = computed<PostBlock | null>(() =>
  form.blocks.find(b => b.id === selectedBlockId.value) ?? null
)
const selectedIndex = computed(() =>
  form.blocks.findIndex(b => b.id === selectedBlockId.value)
)

function selectBlock(id: string) {
  selectedBlockId.value = id
  activeDock.value = 'block'
  dockHidden.value = false
  scrollCanvasToBlock(id)
}

function clearSelection() {
  selectedBlockId.value = null
  dockHidden.value = true
}

function scrollCanvasToBlock(id: string) {
  nextTick(() => {
    const el = canvasEl.value?.querySelector(`[data-block-id="${id}"]`) as HTMLElement | null
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

async function focusField(field: { value: { focus: () => void } | null }) {
  await nextTick()
  field.value?.focus()
}

function editContent(field: ContentField) {
  clearSelection()
  activeDock.value = 'content'
  activeField.value = field
  dockHidden.value = false
  if (field === 'title') void focusField(titleInput)
  else if (field === 'tag') void focusField(tagInput)
  else if (field === 'excerpt') void focusField(excerptInput)
  else if (field === 'author') void focusField(authorInput)
}

// ─── Canvas interactions (direct write) ──────────────────────────────────────

function onCanvasClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  const blockEl = target.closest('[data-block-id]') as HTMLElement | null
  if (blockEl) {
    const id = blockEl.getAttribute('data-block-id')
    if (id) selectBlock(id)
    return
  }

  const editEl = target.closest('[data-edit]') as HTMLElement | null
  if (editEl) {
    editContent(editEl.getAttribute('data-edit') as ContentField)
    return
  }

  clearSelection()
}

// Canvas drag-to-reorder blocks (mirrors the album editor's live-canvas drag)
const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)

function blockIndexFromEvent(event: DragEvent): number | null {
  const el = (event.target as HTMLElement).closest('[data-block-n]') as HTMLElement | null
  if (!el) return null
  const n = parseInt(el.getAttribute('data-block-n') || '', 10)
  return Number.isNaN(n) ? null : n
}

function onCanvasDragStart(event: DragEvent) {
  const idx = blockIndexFromEvent(event)
  if (idx === null) { event.preventDefault(); return }
  dragFromIndex.value = idx
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(idx))
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-200px;width:1px;height:1px;opacity:0'
    document.body.appendChild(ghost)
    event.dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => ghost.remove())
  }
}

function onCanvasDragOver(event: DragEvent) {
  if (dragFromIndex.value === null) return
  event.preventDefault()
  dragOverIndex.value = blockIndexFromEvent(event)
}

function onCanvasDrop(event: DragEvent) {
  if (dragFromIndex.value === null) return
  event.preventDefault()
  const to = blockIndexFromEvent(event)
  if (to !== null) moveBlock(dragFromIndex.value, to)
  onCanvasDragEnd()
}

function onCanvasDragEnd() {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

function moveBlock(from: number, to: number) {
  if (from === to || from < 0 || to < 0) return
  const next = [...form.blocks]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item!)
  form.blocks = next
}

// ─── Tray block-list drag reorder ────────────────────────────────────────────

const listDragFrom = ref<number | null>(null)
const listDragOver = ref<number | null>(null)

function onListDragStart(i: number) { listDragFrom.value = i }
function onListDragOver(i: number) { listDragOver.value = i }
function onListDragEnd() { listDragFrom.value = null; listDragOver.value = null }
function onListDrop(to: number) {
  if (listDragFrom.value !== null) moveBlock(listDragFrom.value, to)
  onListDragEnd()
}

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
  selectBlock(block.id)
}

function removeBlock(id: string) {
  const index = form.blocks.findIndex(b => b.id === id)
  if (index === -1) return
  form.blocks.splice(index, 1)
  if (!form.blocks.length) form.blocks.push(makeBlock('text'))
  if (selectedBlockId.value === id) clearSelection()
}

function onPaletteKey(e: KeyboardEvent) {
  if (e.key === 'Escape') paletteOpen.value = false
}
watch(paletteOpen, v => {
  if (!import.meta.client) return
  if (v) document.addEventListener('keydown', onPaletteKey)
  else document.removeEventListener('keydown', onPaletteKey)
})

// ─── Image picker — hero, avatar, block images, and photo-story import ────────

type ImageTarget =
  | { kind: 'hero' }
  | { kind: 'avatar' }
  | { kind: 'story' }
  | { kind: 'block', id: string, field: 'src' | 'src1' | 'src2' }

const imagePickerOpen = ref(false)
const imagePickerTarget = ref<ImageTarget | null>(null)
const uploadedPhotoKeys = ref<string[]>([])
const clearImagesOpen = ref(false)

function openImagePicker(target: ImageTarget) {
  imagePickerTarget.value = target
  imagePickerOpen.value = true
}

function onImagePick(keys: string[]) {
  const target = imagePickerTarget.value
  const key = keys[0]
  if (!target || (!key && target.kind !== 'story')) return
  if (target.kind === 'story') {
    insertPhotoStory(keys)
    return
  }
  const path = `/images/${key}`
  if (target.kind === 'hero') form.image = path
  else if (target.kind === 'avatar') form.authorAvatar = path
  else {
    const block = form.blocks.find(b => b.id === target.id) as Record<string, unknown> | undefined
    if (block) block[target.field] = path
  }
}

function onPhotosUploaded(keys: string[]) {
  uploadedPhotoKeys.value = [...new Set([...uploadedPhotoKeys.value, ...keys])]
  insertPhotoStory(keys)
}

function insertPhotoStory(keys: string[]) {
  const paths = keys.map(key => `/images/${key}`).filter(Boolean)
  if (!paths.length) return

  if (!form.image) form.image = paths[0]!

  const blocks: PostBlock[] = []
  for (let i = 0; i < paths.length; i += 2) {
    const first = paths[i]!
    const second = paths[i + 1]
    if (second) {
      blocks.push({ id: uid(), type: 'photo-pair', src1: first, src2: second, caption: '' })
    } else {
      blocks.push({ id: uid(), type: 'photo-full', src: first, caption: '' })
    }
  }

  const hasOnlyEmptyStarter = form.blocks.length === 1
    && form.blocks[0]?.type === 'text'
    && !(form.blocks[0] as { content?: string }).content?.trim()

  if (hasOnlyEmptyStarter) form.blocks = blocks
  else form.blocks.push(...blocks)
}

const articleImageCount = computed(() => {
  let count = form.image ? 1 : 0
  if (form.authorAvatar) count += 1
  for (const block of form.blocks) {
    const item = block as Record<string, unknown>
    if (block.type === 'image' && item.src) count += 1
    if (block.type === 'photo-full' && item.src) count += 1
    if (block.type === 'photo-pair') {
      if (item.src1) count += 1
      if (item.src2) count += 1
    }
  }
  return count
})

function clearArticleImages() {
  form.image = ''
  form.authorAvatar = ''
  form.blocks = form.blocks
    .map((block) => {
      if (block.type === 'image') return { ...block, src: '' }
      if (block.type === 'photo-full') return { ...block, src: '' }
      if (block.type === 'photo-pair') return { ...block, src1: '', src2: '' }
      return block
    })
    .filter(block => !(
      (block.type === 'image' || block.type === 'photo-full') && !(block as { caption?: string }).caption?.trim()
    ))
    .filter(block => !(block.type === 'photo-pair' && !(block as { caption?: string }).caption?.trim()))
  if (!form.blocks.length) form.blocks = [makeBlock('text')]
  clearImagesOpen.value = false
}

// ─── Tray resize (mirrors album editor) ──────────────────────────────────────

const TRAY_MIN_WIDTH = 280
const TRAY_MAX_WIDTH = 460
const TRAY_DEFAULT_WIDTH = 360
const trayWidth = ref(TRAY_DEFAULT_WIDTH)
const isResizingTray = ref(false)

function clampTrayWidth(width: number) {
  if (typeof window === 'undefined') return Math.min(TRAY_MAX_WIDTH, Math.max(TRAY_MIN_WIDTH, width))
  const viewportMax = Math.min(TRAY_MAX_WIDTH, Math.floor(window.innerWidth * 0.42))
  return Math.min(viewportMax, Math.max(TRAY_MIN_WIDTH, width))
}
function onTrayResizeMove(e: PointerEvent) {
  if (isResizingTray.value) trayWidth.value = clampTrayWidth(e.clientX)
}
function stopTrayResize() {
  if (!isResizingTray.value) return
  isResizingTray.value = false
  window.removeEventListener('pointermove', onTrayResizeMove)
  window.removeEventListener('pointerup', stopTrayResize)
  window.removeEventListener('pointercancel', stopTrayResize)
}
function startTrayResize(e: PointerEvent) {
  e.preventDefault()
  isResizingTray.value = true
  window.addEventListener('pointermove', onTrayResizeMove)
  window.addEventListener('pointerup', stopTrayResize)
  window.addEventListener('pointercancel', stopTrayResize)
}
function onTrayResizeKeydown(e: KeyboardEvent) {
  const step = e.shiftKey ? 40 : 16
  if (e.key === 'ArrowLeft') { e.preventDefault(); trayWidth.value = clampTrayWidth(trayWidth.value - step) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); trayWidth.value = clampTrayWidth(trayWidth.value + step) }
  else if (e.key === 'Home') { e.preventDefault(); trayWidth.value = clampTrayWidth(TRAY_MIN_WIDTH) }
  else if (e.key === 'End') { e.preventDefault(); trayWidth.value = clampTrayWidth(TRAY_MAX_WIDTH) }
}
onMounted(() => { trayWidth.value = clampTrayWidth(Math.round(window.innerWidth * 0.26)) })
onUnmounted(stopTrayResize)

// ─── Editor hint ─────────────────────────────────────────────────────────────

const hintDismissed = ref(
  typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('cu-post-editor-hint-v1')
)
let hintTimer: ReturnType<typeof setTimeout>
function dismissHint() {
  hintDismissed.value = true
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('cu-post-editor-hint-v1', '1')
}
onMounted(() => { if (!hintDismissed.value) hintTimer = setTimeout(dismissHint, 7000) })
onUnmounted(() => clearTimeout(hintTimer))

// ─── Dirty tracking + unsaved guard ──────────────────────────────────────────

const dirty = ref(false)
const initialized = ref(false)
const unsavedLeaveOpen = ref(false)
const pendingLeaveTo = ref<string | null>(null)
const allowPendingLeave = ref(false)

watch(form, () => { if (initialized.value) dirty.value = true }, { deep: true })
onMounted(() => nextTick(() => { initialized.value = true }))

onBeforeRouteLeave((to) => {
  if (!dirty.value || allowPendingLeave.value) return true
  pendingLeaveTo.value = to.fullPath
  unsavedLeaveOpen.value = true
  return false
})
function cancelPendingLeave() {
  pendingLeaveTo.value = null
  unsavedLeaveOpen.value = false
}
async function discardAndLeave() {
  const target = pendingLeaveTo.value
  if (!target) { cancelPendingLeave(); return }
  allowPendingLeave.value = true
  dirty.value = false
  unsavedLeaveOpen.value = false
  pendingLeaveTo.value = null
  await router.push(target)
}
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (!dirty.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))

// ─── Templates ───────────────────────────────────────────────────────────────

interface Template {
  nameKey: string
  descKey: string
  blocks: () => PostBlock[]
}

const TEMPLATES: Template[] = [
  {
    nameKey: 'adminPostForm.tplEssay',
    descKey: 'adminPostForm.tplEssayDesc',
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
    nameKey: 'adminPostForm.tplInterview',
    descKey: 'adminPostForm.tplInterviewDesc',
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
    nameKey: 'adminPostForm.tplPhotoEssay',
    descKey: 'adminPostForm.tplPhotoEssayDesc',
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
    nameKey: 'adminPostForm.tplReview',
    descKey: 'adminPostForm.tplReviewDesc',
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
    nameKey: 'adminPostForm.tplRecap',
    descKey: 'adminPostForm.tplRecapDesc',
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
    const a = b as Record<string, string | undefined>
    return a.content || a.question || a.answer || a.src || a.src1
  })
  if (hasContent && !confirm(t('adminPostForm.tplReplaceConfirm', { name: t(tpl.nameKey) }))) return
  form.blocks = tpl.blocks()
  showTemplates.value = false
  clearSelection()
}

// ─── Submit ──────────────────────────────────────────────────────────────────

function onSubmit() {
  const payload = structuredClone(toRaw(form))
  payload.title = payload.title.trim()
  payload.tag = payload.tag.trim()
  payload.date = payload.date.trim()
  payload.published = payload.published.trim()
  payload.image = payload.image.trim()
  payload.excerpt = payload.excerpt.trim()
  payload.author = (payload.author ?? '').trim()
  payload.authorBio = (payload.authorBio ?? '').trim()
  payload.authorAvatar = (payload.authorAvatar ?? '').trim()
  for (const block of payload.blocks) {
    const item = block as Record<string, unknown>
    for (const key of ['content', 'question', 'answer', 'src', 'src1', 'src2', 'caption', 'cite']) {
      if (typeof item[key] === 'string') item[key] = (item[key] as string).trim()
    }
  }
  dirty.value = false
  emit('submit', payload)
}
</script>


<template>
  <form
    class="editor"
    :class="{ 'is-resizing-tray': isResizingTray }"
    :style="{ '--tray-width': `${trayWidth}px` }"
    @submit.prevent="onSubmit"
  >
    <!-- LEFT TRAY -->
    <aside class="tray">
      <!-- Save / Cancel -->
      <div class="tray__topbar">
        <NuxtLink :to="localePath('/admin/posts')" class="btn-ghost">{{ t('admin.cancel') }}</NuxtLink>
        <button type="submit" class="btn-solid" :disabled="busy">
          {{ busy ? t('admin.saving') : (submitLabel || t('admin.save')) }}
        </button>
      </div>

      <!-- Settings -->
      <div class="tray__section">
        <p class="tray__label">{{ t('adminEditor.layout') }}</p>
        <div class="field">
          <label>{{ t('adminPostForm.heroStyle') }}</label>
          <div class="hero-style-grid">
            <button
              v-for="s in HERO_STYLES"
              :key="s.value"
              type="button"
              class="hero-style-btn"
              :class="{ active: (form.heroStyle ?? 'standard') === s.value }"
              @click="form.heroStyle = s.value"
            >{{ t(s.labelKey) }}</button>
          </div>
        </div>
        <div class="field">
          <label>{{ t('adminForm.publishedSort') }}</label>
          <UiDateInput v-model="form.published" />
        </div>
        <div class="field field--visibility">
          <label>{{ t('adminForm.visibility') }}</label>
          <div class="visibility-toggle" role="radiogroup" :aria-label="t('adminPostForm.visibilityAria')">
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
              <span>{{ t(option.labelKey) }}</span>
              <small>{{ t(option.descKey) }}</small>
            </button>
          </div>
        </div>
      </div>

      <!-- Photo library -->
      <div class="tray__section">
        <p class="tray__label">{{ t('adminPostForm.photoLibrary') }}</p>
        <AdminR2ImageUploader
          v-model="uploadedPhotoKeys"
          :prefix="mediaPrefix"
          dropzone-class="tray-dropzone"
          @uploaded="onPhotosUploaded"
        />
        <button type="button" class="tray-action" @click="openImagePicker({ kind: 'story' })">
          <Icon name="heroicons:photo" class="tray-action__icon" />
          <span>{{ t('adminPostForm.insertPhotoStory') }}</span>
        </button>
        <button
          type="button"
          class="tray-action tray-action--danger"
          :disabled="articleImageCount === 0"
          @click="clearImagesOpen = true"
        >
          <Icon name="heroicons:x-mark" class="tray-action__icon" />
          <span>{{ t('adminPostForm.clearArticleImages') }}</span>
        </button>
        <p class="tray-hint">{{ t('adminPostForm.photoLibraryHint') }}</p>
      </div>

      <!-- Palette -->
      <div class="tray__section">
        <p class="tray__label">{{ t('adminPostForm.addBlock') }}</p>
        <div class="palette-actions">
          <button type="button" class="palette-action" @click="openPalette(selectedIndex >= 0 ? selectedIndex : null)">
            <Icon name="heroicons:plus" class="palette-action__icon" />
            <span>{{ t('adminPostForm.addBlockTitle') }}</span>
          </button>
          <button type="button" class="palette-action palette-action--ghost" @click="showTemplates = true">
            <Icon name="heroicons:sparkles" class="palette-action__icon" />
            <span>{{ t('adminPostForm.templates') }}</span>
          </button>
        </div>
      </div>

      <!-- Block list -->
      <div class="tray__section tray__section--grow">
        <p class="tray__label">
          {{ t('adminPostForm.blocks') }}
          <span class="tray__count">{{ form.blocks.length }}</span>
        </p>
        <div class="block-list">
          <div
            v-for="(block, i) in form.blocks"
            :key="block.id"
            class="block-item"
            :class="{
              'is-selected': selectedBlockId === block.id,
              'is-dragging': listDragFrom === i,
              'drop-target': listDragOver === i && listDragFrom !== i
            }"
            draggable="true"
            @click="selectBlock(block.id)"
            @dragstart="onListDragStart(i)"
            @dragover.prevent="onListDragOver(i)"
            @drop.prevent="onListDrop(i)"
            @dragend="onListDragEnd"
          >
            <span class="block-item__drag">⠿</span>
            <span class="block-item__label">{{ t(BLOCK_LABEL[block.type]) }}</span>
            <button
              type="button"
              class="block-item__del"
              :aria-label="t('adminPostForm.removeBlock')"
              @click.stop="removeBlock(block.id)"
            >×</button>
          </div>
        </div>
      </div>
    </aside>

    <!-- RESIZE HANDLE -->
    <button
      type="button"
      class="tray-resize-handle"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('adminForm.resizeTray')"
      :aria-valuemin="TRAY_MIN_WIDTH"
      :aria-valuemax="TRAY_MAX_WIDTH"
      :aria-valuenow="trayWidth"
      :title="t('adminForm.resizeTray')"
      @pointerdown="startTrayResize"
      @keydown="onTrayResizeKeydown"
    >
      <span aria-hidden="true" />
    </button>

    <!-- RIGHT CANVAS -->
    <section
      ref="canvasEl"
      class="canvas"
      @click.capture="onCanvasClick"
      @dragstart.capture="onCanvasDragStart"
      @dragover="onCanvasDragOver"
      @drop.prevent="onCanvasDrop"
      @dragend.capture="onCanvasDragEnd"
    >
      <Transition name="hint">
        <div v-if="!hintDismissed" class="canvas-hint" role="status">
          <span>{{ t('adminPostForm.canvasHint') }}</span>
          <button type="button" class="canvas-hint__dismiss" @click="dismissHint">{{ t('adminEditor.canvasHintDismiss') }}</button>
        </div>
      </Transition>

      <PublicPostArticle
        :post="previewPost"
        editable
        :selected-block-id="selectedBlockId ?? undefined"
        :draggable-blocks="true"
      />
    </section>

    <!-- FLOATING DOCK — Content (hero + metadata) -->
    <section v-show="!dockHidden && activeDock === 'content'" class="context-dock content-dock" aria-live="polite">
      <div class="dock-grid">
        <!-- Hero image anchor -->
        <div class="cover-anchor">
          <div class="cover-anchor__frame" :class="{ 'is-empty': !form.image }">
            <img v-if="form.image" :src="form.image" alt="">
            <span v-else class="cover-anchor__empty">{{ t('adminForm.noImageSelected') }}</span>
            <button
              v-if="form.image"
              type="button"
              class="cover-anchor__clear"
              @click="form.image = ''"
            >{{ t('adminForm.clear') }}</button>
          </div>
          <button type="button" class="cover-pick" @click="openImagePicker({ kind: 'hero' })">
            {{ form.image ? t('adminForm.coverChange') : t('adminPicker.chooseFromLibrary') }}
          </button>
        </div>

        <div class="dock-fields">
          <div class="field field--span2" :class="{ active: activeField === 'title' }">
            <label>{{ t('adminForm.title') }}</label>
            <textarea ref="titleInput" v-model="form.title" rows="2" :placeholder="t('adminPostForm.titlePlaceholder')" @focus="activeField = 'title'" />
          </div>
          <div class="field" :class="{ active: activeField === 'tag' }">
            <label>{{ t('adminPostForm.tag') }}</label>
            <input ref="tagInput" v-model="form.tag" type="text" :placeholder="t('adminPostForm.tagPlaceholder')" @focus="activeField = 'tag'">
          </div>
          <div class="field">
            <label>{{ t('adminForm.dateDisplay') }}</label>
            <UiDateInput v-model="form.date" />
          </div>
          <div class="field field--span2" :class="{ active: activeField === 'excerpt' }">
            <label>{{ t('adminPostForm.excerptPlaceholder') }}</label>
            <textarea ref="excerptInput" v-model="form.excerpt" rows="3" :placeholder="t('adminPostForm.excerptPlaceholder')" @focus="activeField = 'excerpt'" />
          </div>
          <div class="field" :class="{ active: activeField === 'author' }">
            <label>{{ t('adminPostForm.author') }}</label>
            <input ref="authorInput" v-model="form.author" type="text" :placeholder="t('adminPostForm.authorPlaceholder')" @focus="activeField = 'author'">
          </div>
          <div class="field field--span2">
            <label>{{ t('adminPostForm.authorBio') }}</label>
            <textarea v-model="form.authorBio" rows="2" :placeholder="t('adminPostForm.authorBioPlaceholder')" />
          </div>
          <div class="field">
            <label>{{ t('adminPostForm.authorAvatar') }}</label>
            <div class="field-img-row">
              <img v-if="form.authorAvatar" :src="form.authorAvatar" alt="" class="field-img-preview field-img-preview--round">
              <button type="button" class="field-img-pick" @click="openImagePicker({ kind: 'avatar' })">{{ t('adminPicker.chooseFromLibrary') }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- FLOATING DOCK — Selected block -->
    <section v-show="!dockHidden && activeDock === 'block' && selectedBlock" class="context-dock block-dock" aria-live="polite">
      <div class="block-dock__head">
        <div class="block-dock__identity">
          <p class="block-dock__eyebrow">{{ selectedBlock ? t(BLOCK_LABEL[selectedBlock.type]) : '' }}</p>
          <h2>{{ t('adminPostForm.blockN', { n: selectedIndex + 1 }) }}</h2>
        </div>
        <div class="block-dock__ops">
          <button type="button" class="btn-ghost" @click="openPalette(selectedIndex)">{{ t('adminPostForm.insertAfter') }}</button>
          <button type="button" class="btn-ghost danger" @click="selectedBlock && removeBlock(selectedBlock.id)">{{ t('admin.delete') }}</button>
        </div>
      </div>

      <div v-if="selectedBlock" class="block-dock__body">
        <!-- text, lead, pullquote, inset -->
        <textarea
          v-if="selectedBlock.type === 'text' || selectedBlock.type === 'lead' || selectedBlock.type === 'pullquote' || selectedBlock.type === 'inset'"
          v-model="(selectedBlock as any).content"
          rows="4"
          class="prop-textarea"
          :placeholder="selectedBlock.type === 'lead' ? t('adminPostForm.phLead') : selectedBlock.type === 'pullquote' ? t('adminPostForm.phPullquote') : selectedBlock.type === 'inset' ? t('adminPostForm.phInset') : t('adminPostForm.phText')"
        />

        <!-- heading, subheading -->
        <input
          v-else-if="selectedBlock.type === 'heading' || selectedBlock.type === 'subheading'"
          v-model="(selectedBlock as any).content"
          type="text"
          class="prop-input"
          :placeholder="selectedBlock.type === 'heading' ? t('adminPostForm.phHeading') : t('adminPostForm.phSubheading')"
        >

        <!-- blockquote -->
        <template v-else-if="selectedBlock.type === 'blockquote'">
          <textarea v-model="(selectedBlock as any).content" rows="3" class="prop-textarea" :placeholder="t('adminPostForm.phQuote')" />
          <input v-model="(selectedBlock as any).cite" type="text" class="prop-input" :placeholder="t('adminPostForm.phAttribution')">
        </template>

        <!-- image -->
        <template v-else-if="selectedBlock.type === 'image'">
          <div class="prop-photo">
            <img v-if="(selectedBlock as any).src" :src="(selectedBlock as any).src" alt="" class="prop-thumb">
            <button type="button" class="prop-pick-btn" @click="selectedBlock && openImagePicker({ kind: 'block', id: selectedBlock.id, field: 'src' })">
              {{ (selectedBlock as any).src ? t('adminForm.coverChange') : t('adminPicker.chooseFromLibrary') }}
            </button>
          </div>
          <input v-model="(selectedBlock as any).src" type="text" class="prop-input prop-input--url" :placeholder="t('adminPostForm.phImageUrl')">
          <input v-model="(selectedBlock as any).caption" type="text" class="prop-input" :placeholder="t('adminPostForm.phCaption')">
          <label class="prop-check">
            <input v-model="(selectedBlock as any).breakout" type="checkbox">
            {{ t('adminPostForm.breakout') }}
          </label>
        </template>

        <!-- photo-full -->
        <template v-else-if="selectedBlock.type === 'photo-full'">
          <div class="prop-photo">
            <img v-if="(selectedBlock as any).src" :src="(selectedBlock as any).src" alt="" class="prop-thumb">
            <button type="button" class="prop-pick-btn" @click="selectedBlock && openImagePicker({ kind: 'block', id: selectedBlock.id, field: 'src' })">
              {{ (selectedBlock as any).src ? t('adminForm.coverChange') : t('adminPicker.chooseFromLibrary') }}
            </button>
          </div>
          <input v-model="(selectedBlock as any).src" type="text" class="prop-input prop-input--url" :placeholder="t('adminPostForm.phPhotoUrl')">
          <input v-model="(selectedBlock as any).caption" type="text" class="prop-input" :placeholder="t('adminPostForm.phCaption')">
        </template>

        <!-- photo-pair -->
        <template v-else-if="selectedBlock.type === 'photo-pair'">
          <div class="prop-pair">
            <div class="prop-photo">
              <img v-if="(selectedBlock as any).src1" :src="(selectedBlock as any).src1" alt="" class="prop-thumb">
              <button type="button" class="prop-pick-btn" @click="selectedBlock && openImagePicker({ kind: 'block', id: selectedBlock.id, field: 'src1' })">{{ t('adminPostForm.phLeftPhotoUrl') }}</button>
            </div>
            <div class="prop-photo">
              <img v-if="(selectedBlock as any).src2" :src="(selectedBlock as any).src2" alt="" class="prop-thumb">
              <button type="button" class="prop-pick-btn" @click="selectedBlock && openImagePicker({ kind: 'block', id: selectedBlock.id, field: 'src2' })">{{ t('adminPostForm.phRightPhotoUrl') }}</button>
            </div>
          </div>
          <input v-model="(selectedBlock as any).caption" type="text" class="prop-input" :placeholder="t('adminPostForm.phSharedCaption')">
        </template>

        <!-- qanda -->
        <template v-else-if="selectedBlock.type === 'qanda'">
          <textarea v-model="(selectedBlock as any).question" rows="2" class="prop-textarea" :placeholder="t('adminPostForm.phQuestion')" />
          <textarea v-model="(selectedBlock as any).answer" rows="3" class="prop-textarea" :placeholder="t('adminPostForm.phAnswer')" />
        </template>

        <!-- divider -->
        <p v-else-if="selectedBlock.type === 'divider'" class="prop-note">{{ t('adminPostForm.blockDividerDesc') }}</p>
      </div>
    </section>

    <!-- Block picker modal -->
    <Teleport to="body">
      <div v-if="paletteOpen" class="bpm-overlay" @click.self="paletteOpen = false">
        <div class="bpm-panel" role="dialog" aria-modal="true" :aria-label="t('adminPostForm.addBlockTitle')">
          <div class="bpm-header">
            <span class="bpm-title">{{ t('adminPostForm.addBlockTitle') }}</span>
            <button type="button" class="bpm-close" @click="paletteOpen = false">✕</button>
          </div>
          <div class="bpm-body">
            <div v-for="group in ['Text', 'Visual']" :key="group" class="bpm-group">
              <div class="bpm-group-label">{{ group === 'Text' ? t('adminPostForm.groupText') : t('adminPostForm.groupVisual') }}</div>
              <div class="bpm-grid">
                <button
                  v-for="item in PALETTE.filter(p => p.group === group)"
                  :key="item.type"
                  type="button"
                  class="bpm-card"
                  @click="addBlock(item.type)"
                >
                  <div class="bpm-card-info">
                    <span class="bpm-card-name">{{ t(item.labelKey) }}</span>
                    <span class="bpm-card-desc">{{ t(item.descKey) }}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Templates modal -->
    <UiModal v-model="showTemplates" :title="t('adminPostForm.templates')" size="xl">
      <p class="tpl-hint">{{ t('adminPostForm.tplHint') }}</p>
      <div class="tpl-grid">
        <button
          v-for="tpl in TEMPLATES"
          :key="tpl.nameKey"
          type="button"
          class="tpl-card"
          @click="loadTemplate(tpl)"
        >
          <span class="tpl-card__name">{{ t(tpl.nameKey) }}</span>
          <span class="tpl-card__desc">{{ t(tpl.descKey) }}</span>
          <span class="tpl-card__blocks">{{ t('adminPostForm.blockCount', { count: tpl.blocks().length }) }}</span>
        </button>
      </div>
    </UiModal>

    <AdminImagePickerModal
      v-model="imagePickerOpen"
      :prefix="mediaPrefix"
      :multiple="imagePickerTarget?.kind === 'story'"
      :title="t('adminPicker.chooseFromLibrary')"
      @select="onImagePick"
    />

    <UiModal v-model="clearImagesOpen" :title="t('adminPostForm.clearArticleImagesTitle')" size="md">
      <div class="confirm-modal">
        <p>{{ t('adminPostForm.clearArticleImagesBody', { count: articleImageCount }) }}</p>
        <div class="confirm-modal__actions">
          <UiButton variant="secondary" @click="clearImagesOpen = false">{{ t('admin.cancel') }}</UiButton>
          <UiButton variant="danger" :disabled="articleImageCount === 0" @click="clearArticleImages">{{ t('adminPostForm.clearArticleImagesConfirm') }}</UiButton>
        </div>
      </div>
    </UiModal>

    <UiModal
      v-model="unsavedLeaveOpen"
      :title="t('adminEditor.unsavedTitle')"
      @update:model-value="v => { if (!v) cancelPendingLeave() }"
    >
      <p class="confirm-modal__body">{{ t('adminPostForm.unsavedBody') }}</p>
      <div class="confirm-modal__actions">
        <UiButton variant="secondary" @click="cancelPendingLeave">{{ t('adminEditor.unsavedStay') }}</UiButton>
        <UiButton variant="danger" @click="discardAndLeave">{{ t('adminEditor.unsavedDiscard') }}</UiButton>
      </div>
    </UiModal>
  </form>
</template>


<style scoped>
/* ─── Root layout ────────────────────────────────────────────────────────── */
.editor {
  --tray-width: clamp(280px, 26vw, 380px);
  display: flex;
  align-items: flex-start;
  min-height: calc(100vh - 3.5rem);
  background: var(--body-bg);
}
.editor.is-resizing-tray { cursor: ew-resize; user-select: none; }
.editor.is-resizing-tray :deep(*) { cursor: ew-resize !important; }

/* ─── Left tray ──────────────────────────────────────────────────────────── */
.tray {
  width: var(--tray-width);
  min-width: 280px;
  max-width: min(460px, 42vw);
  flex-shrink: 0;
  position: sticky;
  top: 3.5rem;
  height: calc(100vh - 3.5rem);
  overflow: auto;
  scrollbar-width: none;
  border-right: 1px solid var(--subtle);
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--body-bg) 96%, white);
}
.tray::-webkit-scrollbar { display: none; }

.tray__topbar {
  display: flex; gap: 0.5rem; align-items: center; justify-content: flex-end;
  padding: 0.65rem 0.75rem; border-bottom: 1px solid var(--subtle);
  background: var(--body-bg); position: sticky; top: 0; z-index: 2;
}
.tray__topbar .btn-ghost, .tray__topbar .btn-solid {
  flex: 0 0 7.8rem; display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.1rem; text-align: center;
}

.tray__section { padding: 0.85rem 0.85rem 0.7rem; border-bottom: 1px solid var(--subtle); }
.tray__section--grow { flex: 1; border-bottom: none; display: flex; flex-direction: column; }
.tray__label {
  font-size: 0.46rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted);
  margin-bottom: 0.55rem; display: flex; align-items: center; gap: 0.5rem;
}
.tray__count { font-size: 0.46rem; background: var(--accent); color: #fff; padding: 0.1rem 0.4rem; letter-spacing: 0; }

/* Fields */
.field { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.7rem; }
.field:last-child { margin-bottom: 0; }
.field label { font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
.field input, .field select, .field textarea {
  border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.82rem; padding: 0.5rem 0.6rem; outline: none; width: 100%;
}
.field textarea { resize: vertical; line-height: 1.6; }
.field input:focus, .field select:focus, .field textarea:focus { border-color: var(--accent); }
.field :deep(.ui-date-input__text) {
  border: 1px solid var(--subtle); border-radius: 0; background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.82rem; padding: 0.5rem 0.6rem; outline: none;
}
.field :deep(.ui-date-input__text:focus) { border-color: var(--accent); }

/* Hero style grid */
.hero-style-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.4rem; }
.hero-style-btn {
  border: 1px solid var(--subtle); background: #fff; color: var(--muted);
  font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase;
  padding: 0.55rem 0.4rem; cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.hero-style-btn:hover { border-color: var(--accent); color: var(--accent); }
.hero-style-btn.active { background: var(--dark); color: var(--accent); border-color: var(--dark); }

/* Visibility toggle */
.visibility-toggle { display: grid; grid-template-columns: 1fr; border: 1px solid var(--subtle); background: #fff; }
.visibility-toggle__option {
  min-width: 0; border: 0; border-top: 1px solid var(--subtle); background: transparent; color: var(--muted);
  padding: 0.6rem 0.7rem; text-align: left; cursor: pointer; transition: background 0.15s, color 0.15s;
}
.visibility-toggle__option:first-child { border-top: 0; }
.visibility-toggle__option span {
  display: block; margin-bottom: 0.25rem; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.52rem; letter-spacing: 0.14em; line-height: 1.2; text-transform: uppercase;
}
.visibility-toggle__option small { display: block; color: inherit; font-family: var(--font-sans); font-size: 0.56rem; line-height: 1.45; }
.visibility-toggle__option.active { background: var(--dark); color: rgba(245, 244, 240, 0.68); }
.visibility-toggle__option.active span { color: var(--accent); }

/* Tray actions (photo library + palette) */
.tray-action, .palette-action {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.45rem; width: 100%;
  min-height: 2.35rem; margin-top: 0.5rem; border: 1px solid var(--subtle); background: transparent; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase;
  cursor: pointer; transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.tray-action:hover:not(:disabled), .palette-action:hover { border-color: var(--accent); color: var(--accent); }
.tray-action:disabled { opacity: 0.45; cursor: default; }
.tray-action--danger:hover:not(:disabled) { border-color: #b0243c; color: #b0243c; background: color-mix(in srgb, #b0243c 4%, transparent); }
.tray-action__icon, .palette-action__icon { width: 0.85rem; height: 0.85rem; flex-shrink: 0; }
.tray-hint { margin: 0.55rem 0 0; color: var(--muted); font-size: 0.58rem; line-height: 1.55; }
.palette-actions { display: flex; flex-direction: column; }
.palette-action { margin-top: 0; }
.palette-action + .palette-action { margin-top: 0.4rem; }
.palette-action:first-child {
  border-style: dashed; border-color: color-mix(in srgb, var(--accent) 45%, var(--subtle));
  color: var(--accent); background: color-mix(in srgb, var(--accent) 5%, var(--body-bg));
}
.palette-action--ghost { color: var(--muted); }
.tray :deep(.tray-dropzone) { font-size: 0.6rem; }

/* Block list */
.block-list { display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 0.7rem; }
.block-item {
  display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.55rem;
  border: 1px solid var(--subtle); background: #fff; cursor: pointer; transition: border-color 0.12s, background 0.12s;
}
.block-item:hover { border-color: color-mix(in srgb, var(--accent) 55%, var(--subtle)); }
.block-item.is-selected { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 6%, #fff); }
.block-item.is-dragging { opacity: 0.4; }
.block-item.drop-target { border-color: var(--accent); border-style: dashed; }
.block-item__drag { color: var(--subtle); cursor: grab; user-select: none; font-size: 0.9rem; }
.block-item:hover .block-item__drag { color: var(--muted); }
.block-item__label { flex: 1; min-width: 0; font-family: var(--font-sans); font-size: 0.7rem; letter-spacing: 0.04em; color: var(--dark); }
.block-item__del {
  width: 20px; height: 20px; border: 1px solid transparent; background: transparent; color: var(--muted);
  cursor: pointer; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.block-item__del:hover { color: #c0392b; border-color: #c0392b; }

/* ─── Resize handle ──────────────────────────────────────────────────────── */
.tray-resize-handle {
  align-self: flex-start; position: sticky; top: calc(50vh + 1.75rem); z-index: 45;
  width: 1rem; height: 3.75rem; margin-left: -0.5rem; margin-right: -0.5rem; padding: 0; border: 0;
  background: transparent; cursor: ew-resize; flex: 0 0 1rem; touch-action: none;
}
.tray-resize-handle::before {
  content: ''; position: absolute; top: 50%; left: 50%; width: 0.72rem; height: 2.65rem;
  transform: translate(-50%, -50%); background: color-mix(in srgb, var(--body-bg) 90%, white);
  border: 1px solid color-mix(in srgb, var(--muted) 38%, transparent); border-radius: 999px;
  box-shadow: 0 0.25rem 0.8rem rgba(26, 25, 24, 0.08); transition: border-color 0.16s, box-shadow 0.16s, transform 0.16s;
}
.tray-resize-handle span {
  position: absolute; top: 50%; left: 50%; width: 0.24rem; height: 1.35rem; transform: translate(-50%, -50%); z-index: 1;
  background: linear-gradient(var(--muted), var(--muted)) left center / 1px 100% no-repeat,
    linear-gradient(var(--muted), var(--muted)) right center / 1px 100% no-repeat;
}
.tray-resize-handle:hover::before, .tray-resize-handle:focus-visible::before, .editor.is-resizing-tray .tray-resize-handle::before {
  border-color: var(--accent); background: color-mix(in srgb, var(--body-bg) 84%, white);
  box-shadow: 0 0.35rem 1rem color-mix(in srgb, var(--accent) 16%, transparent); transform: translate(-50%, -50%) scale(1.04);
}
.tray-resize-handle:hover span, .tray-resize-handle:focus-visible span, .editor.is-resizing-tray .tray-resize-handle span {
  background: linear-gradient(var(--accent), var(--accent)) left center / 1px 100% no-repeat,
    linear-gradient(var(--accent), var(--accent)) right center / 1px 100% no-repeat;
}
.tray-resize-handle:focus-visible { outline: 2px solid color-mix(in srgb, var(--accent) 72%, white); outline-offset: 3px; }

/* ─── Canvas ─────────────────────────────────────────────────────────────── */
.canvas {
  flex: 1; min-width: 0; position: relative;
  min-height: calc(100vh - 3.5rem);
  padding-bottom: 22rem; /* room so the floating dock never covers the article tail */
}
/* Empty text-ish blocks stay clickable in the live canvas */
.canvas :deep(.post--editable [data-block-n]:empty) {
  min-height: 2.2rem;
  border: 1px dashed color-mix(in srgb, var(--accent) 40%, transparent);
  border-radius: 3px;
}

.canvas-hint {
  position: sticky; top: 4.5rem; z-index: 20; margin: 1rem auto 0; width: max-content; max-width: 90%;
  display: flex; align-items: center; gap: 1rem; padding: 0.6rem 0.6rem 0.6rem 1rem;
  background: var(--dark); color: rgba(245, 244, 240, 0.85);
  font-family: var(--font-sans); font-size: 0.62rem; letter-spacing: 0.04em;
  box-shadow: 0 0.75rem 2rem rgba(0, 0, 0, 0.25);
}
.canvas-hint__dismiss {
  border: 1px solid rgba(245, 244, 240, 0.25); background: transparent; color: rgba(245, 244, 240, 0.85);
  font-family: var(--font-sans); font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase;
  padding: 0.35rem 0.7rem; cursor: pointer; white-space: nowrap;
}
.canvas-hint__dismiss:hover { border-color: var(--accent); color: var(--accent); }
.hint-enter-active, .hint-leave-active { transition: opacity 0.3s; }
.hint-enter-from, .hint-leave-to { opacity: 0; }

/* ─── Floating context docks ─────────────────────────────────────────────── */
.context-dock {
  position: fixed; bottom: 1rem; right: 1rem; z-index: 60;
  width: min(560px, calc(100vw - var(--tray-width) - 3rem));
  max-height: min(58vh, 620px); overflow: auto;
  background: color-mix(in srgb, var(--body-bg) 96%, white);
  border: 1px solid var(--subtle); box-shadow: 0 1.5rem 3.5rem rgba(26, 25, 24, 0.22);
  padding: 1.1rem 1.2rem;
}

/* Content dock */
.dock-grid { display: grid; grid-template-columns: 140px 1fr; gap: 1rem; align-items: start; }
.cover-anchor { display: flex; flex-direction: column; gap: 0.5rem; }
.cover-anchor__frame {
  position: relative; aspect-ratio: 4 / 3; border: 1px solid var(--subtle); background: var(--paper);
  overflow: hidden; display: flex; align-items: center; justify-content: center;
}
.cover-anchor__frame.is-empty { border-style: dashed; }
.cover-anchor__frame img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cover-anchor__empty { font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); text-align: center; padding: 0.5rem; }
.cover-anchor__clear {
  position: absolute; top: 0.35rem; right: 0.35rem; border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(12, 12, 10, 0.55); color: #fff; font-size: 0.5rem; letter-spacing: 0.12em; text-transform: uppercase;
  padding: 0.2rem 0.45rem; cursor: pointer;
}
.cover-pick {
  border: 1px solid var(--subtle); background: none; color: var(--dark); padding: 0.5rem; cursor: pointer;
  font-family: var(--font-sans); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; transition: border-color 0.15s, color 0.15s;
}
.cover-pick:hover { border-color: var(--accent); color: var(--accent); }

.dock-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 0.7rem; }
.dock-fields .field--span2 { grid-column: span 2; }
.dock-fields .field.active input, .dock-fields .field.active textarea { border-color: var(--accent); }
.field-img-row { display: flex; align-items: center; gap: 0.5rem; }
.field-img-preview { flex-shrink: 0; width: 2.4rem; height: 2.4rem; object-fit: cover; border: 1px solid var(--subtle); background: var(--paper); }
.field-img-preview--round { border-radius: 50%; }
.field-img-pick {
  flex-shrink: 0; border: 1px solid var(--subtle); background: none; color: var(--dark); padding: 0.5rem 0.6rem;
  font-family: var(--font-sans); font-size: 0.52rem; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap; cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.field-img-pick:hover { border-color: var(--accent); color: var(--accent); }

/* Block dock */
.block-dock__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; margin-bottom: 0.9rem; }
.block-dock__eyebrow { font-size: 0.46rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.2rem; }
.block-dock__identity h2 { font-family: var(--font-serif); font-size: 1.05rem; font-weight: 300; }
.block-dock__ops { display: flex; gap: 0.4rem; flex-shrink: 0; }
.block-dock__body { display: flex; flex-direction: column; gap: 0.6rem; }
.prop-input, .prop-textarea {
  width: 100%; border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.85rem; padding: 0.55rem 0.65rem; outline: none;
}
.prop-textarea { resize: vertical; line-height: 1.7; }
.prop-input:focus, .prop-textarea:focus { border-color: var(--accent); }
.prop-input--url { font-family: monospace; font-size: 0.72rem; color: var(--muted); }
.prop-photo { display: flex; align-items: center; gap: 0.6rem; }
.prop-thumb { width: 3.2rem; height: 3.2rem; object-fit: cover; border: 1px solid var(--subtle); flex-shrink: 0; }
.prop-pick-btn {
  flex: 1; border: 1px solid var(--subtle); background: none; color: var(--dark); padding: 0.55rem 0.65rem; cursor: pointer;
  font-family: var(--font-sans); font-size: 0.54rem; letter-spacing: 0.1em; text-transform: uppercase; transition: border-color 0.15s, color 0.15s;
}
.prop-pick-btn:hover { border-color: var(--accent); color: var(--accent); }
.prop-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.prop-check { display: flex; align-items: center; gap: 0.45rem; font-size: 0.72rem; color: var(--muted); cursor: pointer; }
.prop-check input { accent-color: var(--accent); }
.prop-note { font-size: 0.78rem; color: var(--muted); line-height: 1.6; }

/* ─── Buttons ────────────────────────────────────────────────────────────── */
.btn-ghost, .btn-solid {
  font-family: var(--font-sans); font-size: 0.6rem; letter-spacing: 0.16em; text-transform: uppercase;
  padding: 0.6rem 0.9rem; cursor: pointer; text-decoration: none;
}
.btn-ghost { border: 1px solid var(--subtle); background: none; color: var(--dark); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-ghost.danger { color: #b0243c; }
.btn-ghost.danger:hover { border-color: #b0243c; color: #b0243c; }
.btn-solid { background: var(--dark); color: #F5F4F0; border: none; }
.btn-solid:hover:not(:disabled) { background: var(--accent); }
.btn-solid:disabled { opacity: 0.6; cursor: default; }

/* ─── Templates modal ────────────────────────────────────────────────────── */
.tpl-hint { font-size: 0.78rem; color: var(--muted); margin-bottom: 1rem; }
.tpl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.65rem; }
.tpl-card {
  display: flex; flex-direction: column; gap: 0.35rem; text-align: left;
  border: 1px solid var(--subtle); background: transparent; padding: 0.9rem 1rem; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.tpl-card:hover { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 4%, transparent); }
.tpl-card__name { font-family: var(--font-serif); font-size: 1rem; font-weight: 300; }
.tpl-card__desc { font-size: 0.75rem; color: var(--muted); line-height: 1.55; }
.tpl-card__blocks { font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); margin-top: 0.2rem; }

/* ─── Confirm modals ─────────────────────────────────────────────────────── */
.confirm-modal { display: flex; flex-direction: column; gap: 1.2rem; }
.confirm-modal p, .confirm-modal__body { color: var(--muted); font-size: 0.82rem; line-height: 1.65; margin: 0; }
.confirm-modal__actions { display: flex; justify-content: flex-end; gap: 0.65rem; }

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 900px) {
  .editor { flex-direction: column; }
  .tray {
    width: 100%; max-width: none; position: static; height: auto;
    border-right: 0; border-bottom: 1px solid var(--subtle);
  }
  .tray-resize-handle { display: none; }
  .canvas { padding-bottom: 24rem; }
  .context-dock { width: calc(100vw - 2rem); right: 1rem; left: 1rem; }
  .dock-grid { grid-template-columns: 1fr; }
}
</style>

<style>
/* ─── Block picker modal (global — inside Teleport) ──────────────────────── */
.bpm-overlay {
  position: fixed; inset: 0; z-index: 9000; background: rgba(12, 12, 10, 0.72);
  display: flex; align-items: center; justify-content: center; padding: 1.5rem;
}
.bpm-panel {
  background: #1A1A18; width: 100%; max-width: 720px; max-height: 88vh;
  display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 32px 80px rgba(0, 0, 0, 0.6);
}
.bpm-header {
  display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 1.75rem;
  border-bottom: 1px solid rgba(245, 244, 240, 0.08); flex-shrink: 0;
}
.bpm-title { font-family: var(--font-serif); font-size: 1.05rem; font-weight: 300; color: rgba(245, 244, 240, 0.9); }
.bpm-close { background: none; border: none; cursor: pointer; color: rgba(245, 244, 240, 0.3); font-size: 0.85rem; padding: 0.25rem; transition: color 0.15s; }
.bpm-close:hover { color: rgba(245, 244, 240, 0.9); }
.bpm-body { overflow-y: auto; padding: 1.5rem 1.75rem 2rem; display: flex; flex-direction: column; gap: 2rem; }
.bpm-group-label { font-size: 0.44rem; letter-spacing: 0.26em; text-transform: uppercase; color: rgba(245, 244, 240, 0.25); margin-bottom: 0.9rem; }
.bpm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.65rem; }
.bpm-card {
  display: flex; flex-direction: column; background: rgba(245, 244, 240, 0.03);
  border: 1px solid rgba(245, 244, 240, 0.09); cursor: pointer; text-align: left;
  transition: border-color 0.15s, background 0.15s; padding: 0; font-family: var(--font-sans);
}
.bpm-card:hover { border-color: var(--accent); background: rgba(245, 244, 240, 0.06); }
.bpm-card-info { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.85rem 0.95rem 0.95rem; }
.bpm-card-name { font-size: 0.48rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); }
.bpm-card-desc { font-size: 0.72rem; color: rgba(245, 244, 240, 0.45); line-height: 1.55; }
@media (max-width: 640px) {
  .bpm-grid { grid-template-columns: 1fr; }
  .bpm-panel { max-height: 92vh; }
}
</style>
