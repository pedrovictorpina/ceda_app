<script setup lang="ts">
import { formatBRL } from '~/utils/storeCart'
import { formatCount, type ProductRank } from '~/utils/adminDashboard'

const props = defineProps<{ items: ProductRank[] }>()

const maxQuantity = computed(() => Math.max(1, ...props.items.map(item => item.quantity)))

function share(quantity: number) {
  return `${Math.max(2, (quantity / maxQuantity.value) * 100)}%`
}
</script>

<template>
  <ol class="space-y-3.5">
    <li
      v-for="item in items"
      :key="item.id"
      class="min-w-0"
    >
      <div class="flex items-baseline justify-between gap-3 text-sm">
        <span class="min-w-0 truncate font-medium text-default">{{ item.name }}</span>
        <span class="shrink-0 text-right">
          <span class="font-semibold text-highlighted">{{ formatCount(item.quantity) }} un.</span>
          <span class="ml-1.5 text-muted">{{ formatBRL(item.revenue) }}</span>
        </span>
      </div>
      <div
        class="mt-1.5 h-2 rounded-full bg-[var(--viz-track)]"
        aria-hidden="true"
      >
        <div
          class="h-2 rounded-full bg-[var(--viz-mark)]"
          :style="{ width: share(item.quantity) }"
        />
      </div>
    </li>
  </ol>
</template>
