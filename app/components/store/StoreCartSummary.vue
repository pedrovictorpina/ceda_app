<script setup lang="ts">
import { formatBRL } from '~/utils/storeCart'

defineProps<{ total: number, count: number, placing: boolean, error?: string }>()
const emit = defineEmits<{ submit: [] }>()
</script>

<template>
  <div class="space-y-3">
    <p
      v-if="error"
      class="rounded-xl bg-error/10 px-3 py-2 text-sm text-error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="flex items-baseline justify-between">
      <span class="text-sm text-muted">
        Total{{ count ? ` de ${count} ${count === 1 ? 'item' : 'itens'}` : '' }}
      </span>
      <span class="text-2xl font-bold tabular-nums text-highlighted">{{ formatBRL(total) }}</span>
    </div>
    <UButton
      block
      size="xl"
      class="rounded-full"
      :disabled="!count"
      :loading="placing"
      icon="i-lucide-send"
      label="Enviar pedido"
      @click="emit('submit')"
    />
    <p class="text-center text-xs leading-4 text-muted">
      Os itens ficam reservados. Informe o número do pedido no caixa e na retirada.
    </p>
  </div>
</template>
