<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface Post {
  id: number
  slug: string
  title: string
  excerpt: string | null
  body: string
  coverR2Key: string | null
  tags: string[]
  status: 'draft' | 'published'
  publishedAt: string | null
}

const route = useRoute()
const id = Number(route.params.id)

const { data: post, refresh, error } = await useFetch<Post>(`/api/admin/posts/${id}`)
if (error.value || !post.value) throw createError({ statusCode: 404, statusMessage: 'ไม่พบบทความ', fatal: true })

useHead(() => ({ title: post.value?.title || 'บทความ' }))

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}

const form = reactive({
  title: '', slug: '', excerpt: '', body: '', coverR2Key: null as string | null,
  tagsInput: '', status: 'draft' as 'draft' | 'published'
})
watchEffect(() => {
  const p = post.value
  if (p) Object.assign(form, {
    title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', body: p.body ?? '',
    coverR2Key: p.coverR2Key, tagsInput: (p.tags ?? []).join(', '), status: p.status
  })
})

const saving = ref(false)
const savedMsg = ref('')
async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch(`/api/admin/posts/${id}`, {
      method: 'PATCH',
      body: {
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt || null,
        body: form.body,
        coverR2Key: form.coverR2Key,
        tags: form.tagsInput.split(',').map(t => t.trim()).filter(Boolean),
        status: form.status
      }
    })
    savedMsg.value = 'บันทึกแล้ว'
    await refresh()
  } catch (e) {
    savedMsg.value = errMsg(e, 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}

const confirmDelete = ref(false)
const deleting = ref(false)
async function remove() {
  deleting.value = true
  try {
    await $fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    await navigateTo('/admin/blog')
  } catch (e) {
    alert(errMsg(e, 'ลบไม่สำเร็จ'))
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="post">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm text-ink-soft">
        <NuxtLink to="/admin/blog" class="hover:text-ink"><Icon name="heroicons:arrow-left" class="size-4" /></NuxtLink>
        <span>บทความ</span>
        <Icon name="heroicons:chevron-right" class="size-3" />
        <span class="max-w-[16rem] truncate text-ink">{{ post.title }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UiButton v-if="post.status === 'published'" variant="secondary" size="sm" :to="`/blog/${post.slug}`" target="_blank">
          <Icon name="heroicons:arrow-top-right-on-square" class="size-4" /> ดูบนเว็บไซต์
        </UiButton>
        <UiButton variant="danger" size="sm" @click="confirmDelete = true">
          <Icon name="heroicons:trash" class="size-4" /> ลบ
        </UiButton>
        <UiButton size="sm" :loading="saving" @click="save">บันทึก</UiButton>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section class="space-y-4 rounded-lg border border-line bg-white p-5">
        <UiField label="ชื่อบทความ" input-id="b-title">
          <UiInput id="b-title" v-model="form.title" />
        </UiField>
        <UiField label="Slug (URL)" input-id="b-slug" :hint="`/blog/${form.slug}`">
          <UiInput id="b-slug" v-model="form.slug" />
        </UiField>
        <UiField label="เกริ่นนำ (excerpt)" input-id="b-excerpt" hint="แสดงในหน้ารายการและผลการค้นหา">
          <UiTextarea id="b-excerpt" v-model="form.excerpt" :rows="2" />
        </UiField>
        <UiField label="เนื้อหา (Markdown)" input-id="b-body">
          <UiTextarea id="b-body" v-model="form.body" :rows="18" class="font-mono" />
        </UiField>
      </section>

      <aside class="space-y-5">
        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">เผยแพร่</h3>
          <div class="mt-3 space-y-3">
            <UiField label="สถานะ" input-id="b-status">
              <UiSelect id="b-status" v-model="form.status">
                <option value="draft">ฉบับร่าง</option>
                <option value="published">เผยแพร่</option>
              </UiSelect>
            </UiField>
            <div class="flex items-center gap-3">
              <UiButton block :loading="saving" @click="save">บันทึก</UiButton>
            </div>
            <p v-if="savedMsg" class="text-center text-sm text-ink-soft">{{ savedMsg }}</p>
          </div>
        </div>

        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">รูปปก</h3>
          <div class="mt-3">
            <AdminCoverUploader v-model="form.coverR2Key" prefix="posts/covers" />
          </div>
        </div>

        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">แท็ก</h3>
          <div class="mt-3">
            <UiInput v-model="form.tagsInput" placeholder="คั่นด้วยจุลภาค เช่น ข่าว, workshop" />
          </div>
        </div>
      </aside>
    </div>

    <UiModal v-model="confirmDelete" title="ลบบทความ">
      <p class="text-sm text-ink-soft">ต้องการลบบทความ <span class="font-medium text-ink">{{ post.title }}</span> ใช่หรือไม่?</p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="confirmDelete = false">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="remove">ลบ</UiButton>
      </div>
    </UiModal>
  </div>
</template>
