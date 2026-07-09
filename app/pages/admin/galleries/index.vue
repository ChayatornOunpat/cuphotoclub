<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useHead({ title: () => t('adminGalleries.title') })

interface AlbumRow {
  id: number
  slug: string
  title: string
  description: string | null
  eventDate: string | null
  status: 'draft' | 'published'
  photoCount: number
  coverKey: string | null
}

const { data: albums, pending } = await useFetch<AlbumRow[]>('/api/admin/galleries')

const showCreate = ref(false)
const saving = ref(false)
const createErr = ref('')
const form = reactive({ title: '', eventDate: '', description: '', status: 'draft' })

function openCreate() {
  Object.assign(form, { title: '', eventDate: '', description: '', status: 'draft' })
  createErr.value = ''
  showCreate.value = true
}

async function create() {
  saving.value = true
  createErr.value = ''
  try {
    const album = await $fetch('/api/admin/galleries', {
      method: 'POST',
      body: {
        title: form.title,
        eventDate: form.eventDate || null,
        description: form.description || undefined,
        status: form.status
      }
    })
    await navigateTo(`/admin/galleries/${album.id}`)
  } catch (e) {
    createErr.value = (e as { data?: { message?: string } })?.data?.message || t('adminGalleries.createFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ t('adminGalleries.title') }}</h1>
        <p class="mt-1 text-sm text-ink-soft">{{ t('adminGalleries.lead') }}</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="size-4" /> {{ t('adminGalleries.createAlbum') }}
      </UiButton>
    </div>

    <div v-if="albums && albums.length" class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="album in albums"
        :key="album.id"
        :to="`/admin/galleries/${album.id}`"
        class="group overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-sm"
      >
        <div class="aspect-[4/3] overflow-hidden bg-paper-soft">
          <img v-if="album.coverKey" :src="`/images/${album.coverKey}`" :alt="album.title" class="size-full object-cover transition-transform group-hover:scale-[1.02]" loading="lazy">
          <div v-else class="flex size-full items-center justify-center text-ink-soft/40">
            <Icon name="heroicons:photo" class="size-10" />
          </div>
        </div>
        <div class="p-4">
          <div class="flex items-center justify-between gap-2">
            <h3 class="truncate font-semibold text-ink">{{ album.title }}</h3>
            <UiBadge :tone="album.status === 'published' ? 'green' : 'gray'">
              {{ album.status === 'published' ? t('adminGalleries.published') : t('adminGalleries.draft') }}
            </UiBadge>
          </div>
          <p class="mt-1 text-xs text-ink-soft">
            {{ album.eventDate ? formatDate(album.eventDate) : t('adminGalleries.noDate') }} · {{ t('adminGalleries.photoCount', { n: album.photoCount }) }}
          </p>
        </div>
      </NuxtLink>
    </div>

    <div v-else-if="!pending" class="mt-6 rounded-lg border border-dashed border-line bg-white p-12 text-center">
      <Icon name="heroicons:photo" class="mx-auto size-10 text-ink-soft/40" />
      <p class="mt-3 text-sm text-ink-soft">{{ t('adminGalleries.empty') }}</p>
      <div class="mt-4">
        <UiButton @click="openCreate">
          <Icon name="heroicons:plus" class="size-4" /> {{ t('adminGalleries.createAlbum') }}
        </UiButton>
      </div>
    </div>

    <UiModal v-model="showCreate" :title="t('adminGalleries.createNewAlbum')">
      <form class="space-y-4" @submit.prevent="create">
        <p v-if="createErr" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ createErr }}</p>
        <UiField :label="t('adminGalleries.albumTitle')" input-id="a-title">
          <UiTextarea id="a-title" v-model="form.title" required :rows="2" :placeholder="t('adminGalleries.albumTitlePlaceholder')" />
        </UiField>
        <UiField :label="t('adminGalleries.eventDate')" input-id="a-date">
          <UiDateInput id="a-date" v-model="form.eventDate" />
        </UiField>
        <UiField :label="t('adminGalleries.description')" input-id="a-desc">
          <UiTextarea id="a-desc" v-model="form.description" :placeholder="t('adminGalleries.descriptionPlaceholder')" />
        </UiField>
        <UiField :label="t('adminGalleries.status')" input-id="a-status">
          <UiSelect id="a-status" v-model="form.status">
            <option value="draft">{{ t('adminGalleries.draft') }}</option>
            <option value="published">{{ t('adminGalleries.published') }}</option>
          </UiSelect>
        </UiField>
        <div class="flex justify-end gap-2 pt-2">
          <UiButton type="button" variant="secondary" @click="showCreate = false">{{ t('admin.cancel') }}</UiButton>
          <UiButton type="submit" :loading="saving">{{ t('adminGalleries.createAndAdd') }}</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>
