<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Fale Conosco' })
const { address } = useOfficialLinks()
</script>

<template>
  <div>
    <PageIntro
      title="Fale Conosco"
      description="Canais oficiais publicados com consentimento, sem expor contatos pessoais de membros."
      icon="i-lucide-mail"
    /><div class="grid gap-4 sm:grid-cols-2">
      <UCard>
        <h2 class="font-semibold">
          Contato geral
        </h2><p class="mt-2 text-sm text-muted">
          Aguardando configuração oficial.
        </p><p class="mt-4 flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-map-pin" />{{ address || 'Endereço oficial ainda não configurado' }}
        </p>
      </UCard><UCard>
        <h2 class="font-semibold">
          Secretaria e pastores
        </h2><p class="mt-2 text-sm text-muted">
          Somente contatos institucionais aprovados serão exibidos.
        </p>
      </UCard>
    </div>
  </div>
</template>
