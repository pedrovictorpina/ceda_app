<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Campanhas' })
</script>

<template>
  <div>
    <PageIntro
      title="Campanhas"
      description="Acompanhe necessidades e metas informativas da igreja."
      icon="i-lucide-hand-coins"
    /><UCard class="max-w-2xl">
      <UBadge
        color="neutral"
        variant="subtle"
        label="Exemplo de conteúdo"
      /><h2 class="mt-3 text-xl font-bold">
        Nova mesa de som
      </h2><p class="mt-2 text-muted">
        Campanha demonstrativa para validar a apresentação visual. Nenhuma cobrança ou gateway está conectado.
      </p><div class="mt-5">
        <div class="mb-2 flex justify-between text-sm">
          <span>Progresso informado</span><span>35%</span>
        </div><UProgress :model-value="35" />
      </div><template #footer>
        <UButton
          disabled
          label="Contribuição ainda não habilitada"
        />
      </template>
    </UCard>
  </div>
</template>
