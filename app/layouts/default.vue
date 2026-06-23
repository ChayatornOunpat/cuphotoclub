<template>
  <div class="flex min-h-screen flex-col">
    <PublicSiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <PublicSiteFooter />
  </div>
</template>
