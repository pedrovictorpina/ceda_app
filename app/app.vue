<script setup lang="ts">
import { pt_br } from '@nuxt/ui/locale'

const { isLoading } = useLoadingIndicator()

useHead({
  htmlAttrs: { lang: 'pt-BR' },
  link: [
    { rel: 'icon', type: 'image/png', sizes: '192x192', href: '/icons/ceda-192.png' },
    { rel: 'apple-touch-icon', type: 'image/png', sizes: '180x180', href: '/icons/ceda-apple-180.png' }
  ]
})
</script>

<template>
  <UApp :locale="pt_br">
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
