<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Photo {
  id: number
  r2Key: string
  width: number | null
  height: number | null
  caption: string | null
  alt: string | null
  photographer: string | null
  sortOrder: number
}
interface Album {
  id: number
  slug: string
  title: string
  description: string | null
  eventDate: string | null
  status: 'draft' | 'published'
  coverPhotoId: number | null
  publishedAt: string | null
}

const route = useRoute()
const id = Number(route.params.id)

const { data, refresh, error } = await useFetch<{ album: Album, photos: Photo[] }>(`/api/admin/albums/${id}`)
if (error.value) throw createError({ statusCode: 404, statusMessage: 'ไม่พบอัลบั้ม', fatal: true })

const album = computed(() => data.value?.album)
const photos = computed(() => data.value?.photos ?? [])
useHead(() => ({ title: album.value?.title || 'อัลบั้ม' }))

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}

// ---- details form ----
const form = reactive({ title: '', slug: '', eventDate: '', description: '', status: 'draft' as 'draft' | 'published' })
watchEffect(() => {
  const a = album.value
  if (a) {
    Object.assign(form, {
      title: a.title,
      slug: a.slug,
      eventDate: a.eventDate ? new Date(a.eventDate).toISOString().slice(0, 10) : '',
      description: a.description ?? '',
      status: a.status
    })
  }
})
const savingDetails = ref(false)
const detailsMsg = ref('')
async function saveDetails() {
  savingDetails.value = true
  detailsMsg.value = ''
  try {
    await $fetch(`/api/admin/albums/${id}`, {
      method: 'PATCH',
      body: {
        title: form.title,
        slug: form.slug,
        eventDate: form.eventDate || null,
        description: form.description || null,
        status: form.status
      }
    })
    detailsMsg.value = 'บันทึกแล้ว'
    await refresh()
  } catch (e) {
    detailsMsg.value = errMsg(e, 'บันทึกไม่สำเร็จ')
  } finally {
    savingDetails.value = false
  }
}

const editingPhoto = ref<Photo | null>(null)
const photoForm = reactive({ caption: '', photographer: '', alt: '' })
const savingPhoto = ref(false)
function openPhoto(p: Photo) {
  editingPhoto.value = p
  Object.assign(photoForm, { caption: p.caption ?? '', photographer: p.photographer ?? '', alt: p.alt ?? '' })
}
async function savePhoto() {
  if (!editingPhoto.value) return
  savingPhoto.value = true
  try {
    await $fetch(`/api/admin/photos/${editingPhoto.value.id}`, {
      method: 'PATCH',
      body: { caption: photoForm.caption || null, photographer: photoForm.photographer || null, alt: photoForm.alt || null }
    })
    editingPhoto.value = null
    await refresh()
  } catch (e) {
    alert(errMsg(e, 'บันทึกไม่สำเร็จ'))
  } finally {
    savingPhoto.value = false
  }
}

const removingPhoto = ref<Photo | null>(null)
async function removePhoto() {
  if (!removingPhoto.value) return
  try {
    await $fetch(`/api/admin/photos/${removingPhoto.value.id}`, { method: 'DELETE' })
    removingPhoto.value = null
    await refresh()
  } catch (e) {
    alert(errMsg(e, 'ลบไม่สำเร็จ'))
  }
}

// ---- delete album ----
const confirmDeleteAlbum = ref(false)
const deletingAlbum = ref(false)
async function deleteAlbum() {
  deletingAlbum.value = true
  try {
    await $fetch(`/api/admin/albums/${id}`, { method: 'DELETE' })
    await navigateTo('/admin/galleries')
  } catch (e) {
    alert(errMsg(e, 'ลบไม่สำเร็จ'))
    deletingAlbum.value = false
  }
}
</script>

<template>
  <div v-if="album">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm text-ink-soft">
        <NuxtLink to="/admin/galleries" class="hover:text-ink"><Icon name="heroicons:arrow-left" class="size-4" /></NuxtLink>
        <span>แกลเลอรี</span>
        <Icon name="heroicons:chevron-right" class="size-3" />
        <span class="text-ink">{{ album.title }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UiButton v-if="album.status === 'published'" variant="secondary" size="sm" :to="`/galleries/${album.slug}`" target="_blank">
          <Icon name="heroicons:arrow-top-right-on-square" class="size-4" /> ดูบนเว็บไซต์
        </UiButton>
        <UiButton variant="danger" size="sm" @click="confirmDeleteAlbum = true">
          <Icon name="heroicons:trash" class="size-4" /> ลบอัลบั้ม
        </UiButton>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[20rem_1fr]">
      <!-- details -->
      <section class="rounded-lg border border-line bg-white p-5">
        <h2 class="text-sm font-semibold text-ink">รายละเอียดอัลบั้ม</h2>
        <form class="mt-4 space-y-4" @submit.prevent="saveDetails">
          <UiField label="ชื่ออัลบั้ม" input-id="e-title">
            <UiTextarea id="e-title" v-model="form.title" required :rows="2" />
          </UiField>
          <UiField label="Slug (URL)" input-id="e-slug" :hint="`/galleries/${form.slug}`">
            <UiInput id="e-slug" v-model="form.slug" />
          </UiField>
          <UiField label="วันที่จัดกิจกรรม" input-id="e-date">
            <UiDateInput id="e-date" v-model="form.eventDate" />
          </UiField>
          <UiField label="คำอธิบาย" input-id="e-desc">
            <UiTextarea id="e-desc" v-model="form.description" :rows="4" />
          </UiField>
          <UiField label="สถานะ" input-id="e-status">
            <UiSelect id="e-status" v-model="form.status">
              <option value="draft">ฉบับร่าง</option>
              <option value="published">เผยแพร่</option>
            </UiSelect>
          </UiField>
          <div class="flex items-center gap-3 pt-1">
            <UiButton type="submit" :loading="savingDetails">บันทึก</UiButton>
            <span v-if="detailsMsg" class="text-sm text-ink-soft">{{ detailsMsg }}</span>
          </div>
        </form>
      </section>

      <!-- photos -->
      <section class="rounded-lg border border-line bg-white p-5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-ink">รูปภาพ ({{ photos.length }})</h2>
        </div>
        <div class="mt-4">
          <AdminPhotoUploader :album-id="id" @uploaded="refresh" />
        </div>
        <div v-if="photos.length" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          <AdminPhotoTile
            v-for="p in photos"
            :key="p.id"
            :photo="p"
            :is-cover="album.coverPhotoId === p.id"
            @edit="openPhoto(p)"
            @remove="removingPhoto = p"
          />
        </div>
        <p v-else class="mt-5 text-center text-sm text-ink-soft">ยังไม่มีรูปภาพในอัลบั้มนี้</p>
      </section>
    </div>

    <!-- edit photo -->
    <UiModal :model-value="!!editingPhoto" title="แก้ไขรูปภาพ" @update:model-value="v => { if (!v) editingPhoto = null }">
      <form class="space-y-4" @submit.prevent="savePhoto">
        <UiField label="คำบรรยาย" input-id="p-caption">
          <UiInput id="p-caption" v-model="photoForm.caption" />
        </UiField>
        <UiField label="ช่างภาพ" input-id="p-photographer">
          <UiInput id="p-photographer" v-model="photoForm.photographer" />
        </UiField>
        <UiField label="ข้อความแทนภาพ (alt)" input-id="p-alt" hint="ช่วยการเข้าถึงและ SEO">
          <UiInput id="p-alt" v-model="photoForm.alt" />
        </UiField>
        <div class="flex justify-end gap-2 pt-2">
          <UiButton type="button" variant="secondary" @click="editingPhoto = null">ยกเลิก</UiButton>
          <UiButton type="submit" :loading="savingPhoto">บันทึก</UiButton>
        </div>
      </form>
    </UiModal>

    <!-- remove photo -->
    <UiModal :model-value="!!removingPhoto" title="ลบรูปภาพ" @update:model-value="v => { if (!v) removingPhoto = null }">
      <p class="text-sm text-ink-soft">ต้องการลบรูปภาพนี้ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้</p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="removingPhoto = null">ยกเลิก</UiButton>
        <UiButton variant="danger" @click="removePhoto">ลบ</UiButton>
      </div>
    </UiModal>

    <!-- delete album -->
    <UiModal v-model="confirmDeleteAlbum" title="ลบอัลบั้ม">
      <p class="text-sm text-ink-soft">
        ต้องการลบอัลบั้ม <span class="font-medium text-ink">{{ album.title }}</span> และรูปภาพทั้งหมดใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="confirmDeleteAlbum = false">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deletingAlbum" @click="deleteAlbum">ลบอัลบั้ม</UiButton>
      </div>
    </UiModal>
  </div>
</template>
