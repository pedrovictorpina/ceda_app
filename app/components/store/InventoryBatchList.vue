<script setup lang="ts">
defineProps<{
  batches: Array<{
    id: string
    created_at: string
    quantity_received: number
    quantity_on_hand: number
    expires_on: string | null
    product: { name: string } | { name: string }[] | null
  }>
}>()

function productName(product: { name: string } | { name: string }[] | null) {
  return (Array.isArray(product) ? product[0]?.name : product?.name) || 'Produto'
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="batch in batches"
      :key="batch.id"
      class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-default p-3"
    >
      <div>
        <p class="font-semibold">
          {{ productName(batch.product) }}
        </p>
        <p class="text-sm text-muted">
          {{ new Date(batch.created_at).toLocaleDateString('pt-BR') }} · {{ batch.quantity_received }} recebidos · {{ batch.quantity_on_hand }} restantes
        </p>
      </div>
      <UBadge
        v-if="batch.expires_on"
        color="neutral"
        variant="subtle"
        :label="`Validade ${new Date(`${batch.expires_on}T12:00:00`).toLocaleDateString('pt-BR')}`"
      />
    </div>
  </div>
</template>
