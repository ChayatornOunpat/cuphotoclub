<script setup lang="ts">
const props = defineProps<{ error: { statusCode: number, statusMessage?: string, message?: string } }>()

const is404 = computed(() => props.error?.statusCode === 404)
useHead({ title: () => (is404.value ? 'ไม่พบหน้านี้' : 'เกิดข้อผิดพลาด') })
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center bg-paper px-4 text-center">
    <p class="text-sm font-semibold uppercase tracking-widest text-accent">{{ error.statusCode }}</p>
    <h1 class="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
      {{ is404 ? 'ไม่พบหน้าที่คุณค้นหา' : 'เกิดข้อผิดพลาด' }}
    </h1>
    <p class="mt-3 max-w-md text-ink-soft">
      {{ is404 ? 'หน้านี้อาจถูกย้ายหรือลบไปแล้ว' : (error.message || 'กรุณาลองใหม่อีกครั้งภายหลัง') }}
    </p>
    <div class="mt-8 flex gap-3">
      <UiButton to="/">กลับหน้าแรก</UiButton>
      <UiButton variant="secondary" @click="clearError({ redirect: '/' })">ลองใหม่</UiButton>
    </div>
  </div>
</template>
