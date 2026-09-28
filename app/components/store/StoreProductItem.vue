<script setup lang="ts">
import { formatBRL, type StoreProduct } from '~/utils/storeCart'

const props = defineProps<{ product: StoreProduct, quantity: number, imageUrl: string }>()
const emit = defineEmits<{ change: [quantity: number] }>()

const lowStock = computed(() => props.product.stock_available <= 5)
const stockLabel = computed(() => props.product.stock_available === 1
  ? 'Última unidade'
  : lowStock.value ? `Restam ${props.product.stock_available}` : `${props.product.stock_available} disponíveis`)
</script>

<template>
  <article
    class="flex gap-3 rounded-2xl border bg-default p-2.5 transition-colors sm:flex-col sm:gap-0 sm:p-0 sm:overflow-hidden"
    :class="quantity ? 'border-primary/40 bg-primary/[0.03]' : 'border-default'"
  >
    <div class="relative size-24 shrink-0 overflow-hidden rounded-xl bg-elevated sm:aspect-[4/3] sm:size-auto sm:w-full sm:rounded-none">
      <img
        v-if="imageUrl"
        :src="imageUrl"
        :alt="product.name"
        class="size-full object-cover"
        loading="lazy"
      >
      <div
        v-else
        class="grid size-full place-items-center text-primary/60"
      >
        <UIcon
          name="i-lucide-shopping-bag"
          class="size-8 sm:size-10"
        />
      </div>
      <span
        v-if="quantity"
        class="absolute left-1.5 top-1.5 grid min-w-6 place-items-center rounded-full bg-primary px-1.5 text-xs font-bold leading-6 text-white shadow sm:left-3 sm:top-3"
      >{{ quantity }}</span>
    </div>

    <div class="flex min-w-0 flex-1 flex-col sm:p-4">
      <h3 class="line-clamp-2 font-semibold leading-snug text-highlighted">
        {{ product.name }}
      </h3>
      <p
        v-if="product.description"
        class="mt-0.5 line-clamp-1 text-sm text-muted sm:line-clamp-2"
      >
        {{ product.description }}
      </p>
      <p
        class="mt-1 text-xs font-medium"
        :class="lowStock ? 'text-warning' : 'text-muted'"
      >
        {{ stockLabel }}
      </p>

      <div class="mt-auto flex items-center justify-between gap-2 pt-2 sm:pt-4">
        <p class="text-lg font-bold tabular-nums text-highlighted">
          {{ formatBRL(product.sale_price) }}
        </p>
        <StoreQuantityStepper
          v-if="quantity"
          size="sm"
          :quantity="quantity"
          :max="product.stock_available"
          :name="product.name"
          @change="emit('change', $event)"
        />
        <UButton
          v-else
          class="rounded-full"
          icon="i-lucide-plus"
          label="Adicionar"
          :aria-label="`Adicionar ${product.name} ao pedido`"
          @click="emit('change', 1)"
        />
      </div>
    </div>
  </article>
</template>
