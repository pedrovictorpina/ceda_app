<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
useSeoMeta({ title: 'Notícia' })
</script>

<template>
  <article class="mx-auto max-w-3xl">
    <NuxtLink
      to="/noticias"
      class="text-sm text-primary"
    >← Notícias</NuxtLink><UBadge
      class="mt-5"
      label="Notícia"
    /><h1 class="mt-3 text-3xl font-black">
      Notícia {{ route.params.id }}
    </h1><p class="mt-4 text-muted">
      Detalhe-base aguardando conteúdo publicado.
    </p>
  </article>
</template>
