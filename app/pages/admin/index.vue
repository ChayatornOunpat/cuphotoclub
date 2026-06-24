<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const { data: albums, refresh } = await useFetch('/api/admin/albums')
const deleting = ref('')

async function del(id: string, title: string) {
  if (!confirm(t('admin.deleteConfirm', { title }))) return
  deleting.value = id
  try {
    await $fetch(`/api/admin/albums/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.deleteFailed'))
  } finally {
    deleting.value = ''
  }
}

useHead({ title: () => `${t('admin.albums')} — Admin` })
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ t('admin.albums') }}</h1>
        <p class="sub">{{ t((albums?.length ?? 0) === 1 ? 'admin.albumCount' : 'admin.albumCountOther', { count: albums?.length ?? 0 }) }}</p>
      </div>
      <NuxtLink :to="localePath('/admin/albums/new')" class="btn-solid">{{ t('admin.newAlbum') }}</NuxtLink>
    </div>

    <table v-if="albums && albums.length" class="tbl">
      <thead>
        <tr><th>{{ t('admin.tableTitle') }}</th><th>{{ t('admin.tableCategory') }}</th><th>{{ t('admin.tableStyle') }}</th><th>{{ t('admin.tablePlacement') }}</th><th>{{ t('admin.tableFrames') }}</th><th>{{ t('admin.tableDate') }}</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="a in albums" :key="a.id">
          <td class="t-title">{{ a.title }}</td>
          <td>{{ a.category }}</td>
          <td><span class="pill">{{ a.style }}</span></td>
          <td><span class="pill pill--muted">{{ a.placement }}</span></td>
          <td>{{ a.images.length }}</td>
          <td class="t-muted">{{ a.date }}</td>
          <td class="t-actions">
            <NuxtLink :to="localePath(`/admin/albums/${a.id}`)" class="link">{{ t('admin.edit') }}</NuxtLink>
            <button class="link link--del" :disabled="deleting === a.id" @click="del(a.id, a.title)">
              {{ deleting === a.id ? '...' : t('admin.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p v-else class="empty">{{ t('admin.noAlbums') }} <NuxtLink :to="localePath('/admin/albums/new')">{{ t('admin.createFirst') }}</NuxtLink></p>
  </div>
</template>

<style scoped>
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; }
.page-head h1 { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; }
.sub { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--muted); margin-top: 0.35rem; }
.btn-solid { font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.7rem 1.5rem; background: var(--dark); color: #F5F4F0; border: none; cursor: pointer; text-decoration: none; transition: background 0.2s; }
.btn-solid:hover { background: var(--accent); }

.tbl { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.tbl th { text-align: left; font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 500; padding: 0 0.75rem 0.85rem; border-bottom: 1px solid var(--subtle); }
.tbl td { padding: 0.9rem 0.75rem; border-bottom: 1px solid var(--subtle); vertical-align: middle; }
.t-title { font-weight: 500; }
.t-muted { color: var(--muted); }
.pill { font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); border: 1px solid var(--subtle); padding: 0.2rem 0.5rem; }
.pill--muted { color: var(--muted); }
.t-actions { text-align: right; white-space: nowrap; }
.link { font-family: var(--font-sans); font-size: 0.7rem; letter-spacing: 0.05em; background: none; border: none; cursor: pointer; color: var(--dark); text-decoration: none; margin-left: 1rem; transition: color 0.2s; }
.link:hover { color: var(--accent); }
.link--del { color: var(--muted); }
.link--del:hover { color: var(--accent); }
.empty { color: var(--muted); font-size: 0.9rem; }
.empty a { color: var(--accent); }
</style>
