<script setup lang="ts">
const route = useRoute()
const { user } = useUserSession()
const canManage = computed(() => user.value?.role === 'owner' || user.value?.role === 'admin')

interface NavItem { to: string, label: string, icon: string, exact?: boolean }

const items = computed<NavItem[]>(() => [
  { to: '/admin', label: 'แดชบอร์ด', icon: 'heroicons:home', exact: true },
  { to: '/admin/galleries', label: 'แกลเลอรี', icon: 'heroicons:photo' },
  { to: '/admin/blog', label: 'บทความ', icon: 'heroicons:document-text' },
  { to: '/admin/activities', label: 'กิจกรรม', icon: 'heroicons:calendar-days' },
  { to: '/admin/members', label: 'สมาชิก', icon: 'heroicons:user-group' },
  { to: '/admin/about', label: 'เกี่ยวกับเรา', icon: 'heroicons:identification' },
  { to: '/admin/messages', label: 'ข้อความติดต่อ', icon: 'heroicons:inbox' },
  ...(canManage.value
    ? [
        { to: '/admin/users', label: 'ผู้ดูแลระบบ', icon: 'heroicons:user-group' },
        { to: '/admin/settings', label: 'ตั้งค่าเว็บไซต์', icon: 'heroicons:cog-6-tooth' }
      ]
    : [])
])

function isActive(item: NavItem) {
  return item.exact ? route.path === item.to : route.path === item.to || route.path.startsWith(`${item.to}/`)
}
</script>

<template>
  <nav class="flex flex-1 flex-col gap-1 px-3">
    <NuxtLink
      v-for="item in items"
      :key="item.to"
      :to="item.to"
      class="group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
      :class="isActive(item) ? 'bg-accent-soft text-pink-700' : 'text-ink-soft hover:bg-paper-soft hover:text-ink'"
    >
      <Icon :name="item.icon" class="size-5 shrink-0" />
      {{ item.label }}
    </NuxtLink>
  </nav>
</template>
