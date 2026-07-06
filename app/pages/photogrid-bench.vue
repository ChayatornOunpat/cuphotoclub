<script setup lang="ts">
// Scratch page — NOT linked from nav. Isolated preview of the "live
// photogrid" museum-wall concept before wiring it into index.vue in place
// of FeaturedWork.
definePageMeta({ layout: false })
</script>

<template>
  <div class="bench">
    <section class="section-pad">
      <div class="wrap">
        <h1>Live Photogrid bench</h1>
        <ClientOnly>
          <LivePhotoGrid />
        </ClientOnly>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bench {
  min-height: 100vh;
  background: #0c0c0a;
  color: #f5f4f0;
}
h1 {
  font-size: 1rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 1.5rem;
  opacity: 0.6;
}
</style>
