<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Palavra do Dia' })
</script>

<template>
  <div>
    <PageIntro
      title="Palavra do Dia"
      description="Mensagens e versículos publicados por pastores e administradores."
      icon="i-lucide-book-open-text"
    /><UCard class="max-w-3xl">
      <UBadge label="Hoje" /><h2 class="mt-4 text-2xl font-bold">
        Um passo de cada vez
      </h2><p class="mt-3 text-muted">
        A publicação ativa aparecerá aqui. Rascunhos e agendamentos permanecem restritos aos responsáveis.
      </p><template #footer>
        <UButton
          to="/mensagens/exemplo"
          label="Ler e compartilhar"
          trailing-icon="i-lucide-arrow-right"
        />
      </template>
    </UCard>
  </div>
</template>
