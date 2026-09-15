<script setup lang="ts">
useHead({
  htmlAttrs: { lang: 'pt-BR' },
  link: [
    { rel: 'icon', type: 'image/jpeg', href: '/brand/ceda-logo.jpg' },
    { rel: 'apple-touch-icon', href: '/brand/ceda-logo.jpg' }
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
