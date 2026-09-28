<script setup lang="ts">
import { formatBRL, type CartItem } from '~/utils/storeCart'

defineProps<{ cart: CartItem[], imageUrl: (path?: string | null) => string }>()
const emit = defineEmits<{ change: [item: CartItem, quantity: number] }>()
</script>

<template>
  <ul
    v-if="cart.length"
    class="divide-y divide-default"
  >
    <li
      v-for="item in cart"
      :key="item.id"
      class="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
    >
      <div class="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-elevated text-primary/60">
        <img
          v-if="item.image_path"
          :src="imageUrl(item.image_path)"
          alt=""
          class="size-full object-cover"
          loading="lazy"
        >
        <UIcon
          v-else
          name="i-lucide-shopping-bag"
          class="size-5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-highlighted">
          {{ item.name }}
        </p>
        <p class="text-sm tabular-nums text-muted">
          {{ formatBRL(item.sale_price * item.quantity) }}
          <span
            v-if="item.quantity > 1"
            class="text-xs"
          >({{ formatBRL(item.sale_price) }} cada)</span>
        </p>
      </div>
      <StoreQuantityStepper
        size="sm"
        :quantity="item.quantity"
        :max="item.stock_available"
        :name="item.name"
        @change="emit('change', item, $event)"
      />
    </li>
  </ul>
  <div
    v-else
    class="flex flex-col items-center rounded-2xl border border-dashed border-default px-4 py-8 text-center"
  >
    <UIcon
      name="i-lucide-shopping-basket"
      class="size-7 text-muted"
    />
    <p class="mt-2 text-sm text-muted">
      Toque em Adicionar nos produtos para montar seu pedido.
    </p>
  </div>
</template>
