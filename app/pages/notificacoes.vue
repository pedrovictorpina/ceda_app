<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Notificações' })
</script>

<template>
  <div>
    <PageIntro
      title="Notificações"
      description="Avisos, lembretes e chamados importantes em um só lugar."
      icon="i-lucide-bell"
    /><UCard>
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-bell-ring"
          class="mx-auto size-10 text-muted"
        /><h2 class="mt-3 font-semibold">
          Nenhuma notificação nova
        </h2><p class="mt-1 text-sm text-muted">
          Lembretes persistidos aparecerão aqui. O provedor de push ainda é abstrato.
        </p>
      </div>
    </UCard>
  </div>
</template>
