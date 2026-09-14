<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const route = useRoute()
useSeoMeta({ title: 'Mensagem do dia' })
</script>

<template>
  <article class="mx-auto max-w-3xl">
    <NuxtLink
      to="/inicio"
      class="mb-5 inline-flex items-center gap-2 text-sm text-primary"
    ><UIcon name="i-lucide-arrow-left" />Voltar</NuxtLink>
    <UBadge label="Mensagem do dia" /><h1 class="mt-4 text-4xl font-black">
      Um passo de cada vez
    </h1><p class="mt-3 text-sm text-muted">
      Rota compartilhável: {{ route.params.id }}
    </p>
    <div class="prose prose-zinc mt-8 max-w-none dark:prose-invert">
      <p>Este é um conteúdo demonstrativo da tela-base. A versão conectada buscará somente mensagens publicadas e respeitará publicação imediata ou agendada.</p>
    </div>
    <UButton
      class="mt-8"
      icon="i-lucide-share-2"
      label="Compartilhar link"
      color="neutral"
      variant="outline"
    />
  </article>
</template>
