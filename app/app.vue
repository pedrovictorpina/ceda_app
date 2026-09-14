<script setup lang="ts">
useHead({ htmlAttrs: { lang: 'pt-BR' }, link: [{ rel: 'icon', href: '/favicon.ico' }] })
</script>

<template>
  <UApp>
    <NuxtLoadingIndicator color="#f97316" />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
