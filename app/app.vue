<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'pt-BR' },
  link: [
    { rel: 'icon', type: 'image/png', href: '/brand/ceda-logo.png' },
    { rel: 'apple-touch-icon', type: 'image/png', href: '/brand/ceda-logo.png' }
  ]
})
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#f97316" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
