<script setup lang="ts">
import AlbumContact from '~/components/AlbumContact.vue'
import AlbumEssay from '~/components/AlbumEssay.vue'
import AlbumSticky from '~/components/AlbumSticky.vue'

definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: album } = await useFetch(`/api/admin/albums/${id}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

const styleComponent = computed(() => {
  if (album.value?.style === 'sticky') return AlbumSticky
  if (album.value?.style === 'contact') return AlbumContact
  return AlbumEssay
})

const publicPath = computed(() => {
  if (!album.value || album.value.visibility === 'draft') return ''
  return `/albums/${album.value.id}`
})

useHead({ title: () => `${album.value?.title?.replace(/\n+/g, ' ')} - ${t('admin.preview')}` })
</script>

<template>
  <article v-if="album" class="preview-page">
    <nav class="preview-bar" aria-label="Album preview controls">
      <div class="preview-bar__meta">
        <NuxtLink :to="localePath('/admin/albums')" class="preview-bar__back">{{ t('admin.albums') }}</NuxtLink>
        <span class="preview-bar__label">{{ t('admin.preview') }}</span>
        <span class="preview-bar__title">{{ album.title.replace(/\n+/g, ' ') }}</span>
      </div>
      <div class="preview-bar__actions">
        <NuxtLink v-if="publicPath" :to="localePath(publicPath)" class="preview-bar__link" target="_blank" rel="noopener noreferrer">
          Public page
        </NuxtLink>
        <NuxtLink :to="localePath(`/admin/albums/${album.id}`)" class="preview-bar__edit">{{ t('admin.edit') }}</NuxtLink>
      </div>
    </nav>

    <div class="preview-frame">
      <component :is="styleComponent" :album="album" disable-navigation />
    </div>
  </article>
</template>

<style scoped>
.preview-page {
  min-height: 100vh;
  background: var(--body-bg);
}

.preview-bar {
  position: sticky;
  top: 3.95rem;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 0.75rem 2rem;
  border-bottom: 1px solid var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 94%, white);
}

.preview-bar__meta {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.preview-bar__back,
.preview-bar__label,
.preview-bar__link,
.preview-bar__edit {
  flex-shrink: 0;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
}

.preview-bar__back {
  color: var(--muted);
}

.preview-bar__label {
  color: var(--accent);
}

.preview-bar__title {
  min-width: 0;
  overflow: hidden;
  color: var(--dark);
  font-size: 0.72rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-bar__actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.preview-bar__link {
  color: var(--muted);
}

.preview-bar__edit {
  padding: 0.55rem 1rem;
  border: 1px solid var(--dark);
  background: var(--dark);
  color: #F5F4F0;
}

.preview-bar__back:hover,
.preview-bar__link:hover {
  color: var(--accent);
}

.preview-bar__edit:hover {
  border-color: var(--accent);
  background: var(--accent);
}

.preview-frame {
  overflow: hidden;
}

@media (max-width: 780px) {
  .preview-bar {
    top: 0;
    align-items: flex-start;
    flex-direction: column;
    padding: 0.85rem 1.25rem;
  }

  .preview-bar__meta {
    width: 100%;
    flex-wrap: wrap;
  }

  .preview-bar__title {
    width: 100%;
  }
}
</style>
