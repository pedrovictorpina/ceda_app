<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notícias' })
</script>

<template>
  <div>
    <PageIntro
      title="Notícias"
      description="Comunicados editoriais publicados pela igreja."
      icon="i-lucide-newspaper"
    /><UCard>
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-newspaper"
          class="mx-auto size-9 text-muted"
        /><h2 class="mt-3 font-semibold">
          Nenhuma notícia publicada
        </h2><p class="mt-1 text-sm text-muted">
          Notícias reutilizam o histórico, agendamento e autoria da Palavra do Dia.
        </p>
      </div>
    </UCard>
  </div>
</template>
