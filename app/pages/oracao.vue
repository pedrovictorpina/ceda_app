<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Motivos de oração' })
const open = ref(false)
</script>

<template>
  <div>
    <PageIntro
      title="Motivos de oração"
      description="Compartilhe um pedido com privacidade controlada. O padrão é visível apenas para você."
      icon="i-lucide-heart"
    /><div class="mb-5">
      <UButton
        label="Novo motivo"
        icon="i-lucide-plus"
        @click="open = true"
      />
    </div><UAlert
      v-if="open"
      class="mb-5"
      color="neutral"
      variant="subtle"
      title="Formulário preparado"
      description="A persistência será ativada com o Supabase local; nenhuma informação é enviada neste ambiente."
    /><UCard>
      <div class="py-10 text-center">
        <UIcon
          name="i-lucide-lock-keyhole"
          class="mx-auto size-9 text-muted"
        /><h2 class="mt-3 font-semibold">
          Seus pedidos aparecerão aqui
        </h2><p class="mt-1 text-sm text-muted">
          Visibilidade privada, pastoral ou comunitária será escolhida explicitamente.
        </p>
      </div>
    </UCard>
  </div>
</template>
