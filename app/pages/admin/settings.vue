<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin', 'admin-manage'] })
useHead({ title: 'ตั้งค่าเว็บไซต์' })

interface Settings {
  siteDescription: string
  contactEmail: string
  facebookUrl: string
  instagramUrl: string
  lineUrl: string
  footerText: string
}

const { data: settings, refresh } = await useFetch<Settings>('/api/admin/settings')

const form = reactive<Settings>({
  siteDescription: '', contactEmail: '', facebookUrl: '', instagramUrl: '', lineUrl: '', footerText: ''
})
watchEffect(() => {
  if (settings.value) Object.assign(form, settings.value)
})

const saving = ref(false)
const savedMsg = ref('')
async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch('/api/admin/settings', { method: 'PUT', body: { ...form } })
    savedMsg.value = 'บันทึกแล้ว'
    await refresh()
  } catch (e) {
    savedMsg.value = (e as { data?: { message?: string } })?.data?.message || 'บันทึกไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">ตั้งค่าเว็บไซต์</h1>
        <p class="mt-1 text-sm text-ink-soft">ข้อมูลทั่วไป ช่องทางติดต่อ และโซเชียล</p>
      </div>
      <UiButton :loading="saving" @click="save">บันทึก</UiButton>
    </div>

    <div class="mt-6 space-y-6">
      <section class="space-y-4 rounded-lg border border-line bg-white p-5">
        <h2 class="text-sm font-semibold text-ink">ทั่วไป</h2>
        <UiField label="คำอธิบายเว็บไซต์" input-id="s-desc" hint="ใช้สำหรับ SEO">
          <UiTextarea id="s-desc" v-model="form.siteDescription" :rows="2" />
        </UiField>
        <UiField label="ข้อความท้ายเว็บ (footer)" input-id="s-footer">
          <UiInput id="s-footer" v-model="form.footerText" />
        </UiField>
      </section>

      <section class="space-y-4 rounded-lg border border-line bg-white p-5">
        <h2 class="text-sm font-semibold text-ink">ช่องทางติดต่อ</h2>
        <UiField label="อีเมล" input-id="s-email">
          <UiInput id="s-email" v-model="form.contactEmail" type="email" />
        </UiField>
      </section>

      <section class="space-y-4 rounded-lg border border-line bg-white p-5">
        <h2 class="text-sm font-semibold text-ink">โซเชียลมีเดีย</h2>
        <UiField label="Facebook URL" input-id="s-fb">
          <UiInput id="s-fb" v-model="form.facebookUrl" type="url" placeholder="https://facebook.com/…" />
        </UiField>
        <UiField label="Instagram URL" input-id="s-ig">
          <UiInput id="s-ig" v-model="form.instagramUrl" type="url" placeholder="https://instagram.com/…" />
        </UiField>
        <UiField label="LINE URL" input-id="s-line">
          <UiInput id="s-line" v-model="form.lineUrl" type="url" placeholder="https://line.me/…" />
        </UiField>
      </section>

      <div class="flex items-center gap-3">
        <UiButton :loading="saving" @click="save">บันทึก</UiButton>
        <span v-if="savedMsg" class="text-sm text-ink-soft">{{ savedMsg }}</span>
      </div>
    </div>
  </div>
</template>
