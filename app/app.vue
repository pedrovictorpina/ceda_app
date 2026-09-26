<script setup lang="ts">
const { isLoading } = useLoadingIndicator()

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
    <ClientOnly>
      <BrandLoadingScreen
        v-if="isLoading"
        label="Abrindo página…"
      />
    </ClientOnly>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
    <ClientOnly>
      <AppUpdateNotice />
    </ClientOnly>
  </UApp>
</template>
