<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'แดชบอร์ด' })

const { user } = useUserSession()
const { data: stats } = await useFetch('/api/admin/stats')

const cards = computed(() => [
  { label: 'อัลบั้มทั้งหมด', value: stats.value?.albums ?? 0, icon: 'heroicons:photo', to: '/admin/galleries' },
  { label: 'รูปภาพ', value: stats.value?.photos ?? 0, icon: 'heroicons:camera', to: '/admin/galleries' },
  { label: 'บทความ', value: stats.value?.posts ?? 0, icon: 'heroicons:document-text', to: '/admin/blog' },
  { label: 'กิจกรรม', value: stats.value?.events ?? 0, icon: 'heroicons:calendar-days', to: '/admin/activities' },
  { label: 'ข้อความใหม่', value: stats.value?.unreadMessages ?? 0, icon: 'heroicons:inbox', to: '/admin/messages' }
])
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-ink">สวัสดี, {{ user?.name || user?.email }}</h1>
    <p class="mt-1 text-sm text-ink-soft">ภาพรวมระบบจัดการเนื้อหา</p>

    <div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <AdminStatCard v-for="c in cards" :key="c.label" v-bind="c" />
    </div>

    <div class="mt-8 rounded-lg border border-dashed border-line bg-white p-6 text-sm text-ink-soft">
      เริ่มต้นด้วยการสร้าง
      <NuxtLink to="/admin/galleries" class="font-medium text-accent hover:underline">อัลบั้มแกลเลอรี</NuxtLink>
      หรือเขียน
      <NuxtLink to="/admin/blog" class="font-medium text-accent hover:underline">บทความใหม่</NuxtLink>
    </div>
  </div>
</template>
