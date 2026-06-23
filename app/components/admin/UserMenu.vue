<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'

const { user, clear } = useUserSession()

const initials = computed(() =>
  (user.value?.name || user.value?.email || '?').trim().slice(0, 1).toUpperCase()
)

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  await clear()
  await navigateTo('/admin/login')
}
</script>

<template>
  <Menu as="div" class="relative">
    <MenuButton class="flex items-center gap-2 rounded-full p-1 pr-2 hover:bg-paper-soft">
      <span class="flex size-8 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-sm font-semibold text-pink-700">
        <img v-if="user?.avatarUrl" :src="user.avatarUrl" class="size-8 object-cover" alt="">
        <template v-else>{{ initials }}</template>
      </span>
      <span class="hidden max-w-[10rem] truncate text-sm font-medium text-ink sm:block">{{ user?.name || user?.email }}</span>
      <Icon name="heroicons:chevron-down" class="size-4 text-ink-soft" />
    </MenuButton>

    <transition
      enter-active-class="transition duration-100 ease-out" enter-from-class="scale-95 opacity-0" enter-to-class="scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in" leave-from-class="scale-100 opacity-100" leave-to-class="scale-95 opacity-0"
    >
      <MenuItems class="absolute right-0 mt-2 w-52 origin-top-right rounded-lg bg-white p-1 shadow-lg ring-1 ring-line focus:outline-none">
        <div class="px-3 py-2">
          <p class="truncate text-sm font-medium text-ink">{{ user?.name || 'ผู้ดูแล' }}</p>
          <p class="truncate text-xs text-ink-soft">{{ user?.email }}</p>
        </div>
        <div class="my-1 h-px bg-line" />
        <MenuItem v-slot="{ active }">
          <NuxtLink to="/" class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-soft" :class="active ? 'bg-paper-soft text-ink' : ''">
            <Icon name="heroicons:arrow-top-right-on-square" class="size-4" /> ดูเว็บไซต์
          </NuxtLink>
        </MenuItem>
        <MenuItem v-slot="{ active }">
          <button type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-red-600" :class="active ? 'bg-red-50' : ''" @click="logout">
            <Icon name="heroicons:arrow-right-on-rectangle" class="size-4" /> ออกจากระบบ
          </button>
        </MenuItem>
      </MenuItems>
    </transition>
  </Menu>
</template>
