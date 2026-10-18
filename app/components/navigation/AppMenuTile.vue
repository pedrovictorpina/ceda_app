<script setup lang="ts">
import type { SearchableEntry } from '~/utils/navigation'

defineProps<{ item: SearchableEntry, active?: boolean, compact?: boolean }>()
const emit = defineEmits<{ navigate: [] }>()
</script>

<template>
  <ULink
    :to="item.to"
    :aria-label="item.label"
    :aria-current="active ? 'page' : undefined"
    class="focus-ring flex h-full w-full min-w-0 flex-col items-center justify-center rounded-xl border px-2 text-center text-xs font-medium leading-snug transition-colors"
    :class="[
      compact ? 'min-h-16 gap-1.5 py-2' : 'min-h-28 gap-2.5 py-3',
      active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-default bg-elevated/40 text-default hover:bg-elevated'
    ]"
    @click="emit('navigate')"
  >
    <span
      class="grid shrink-0 place-items-center rounded-xl"
      :class="[
        compact ? 'size-6' : 'size-10',
        active ? 'bg-primary text-inverted' : 'bg-primary/10 text-primary'
      ]"
    >
      <UIcon
        :name="item.icon"
        class="size-5"
      />
    </span>
    <span class="w-full min-w-0 wrap-anywhere">{{ item.label }}</span>
    <span
      v-if="item.context && !compact"
      class="w-full min-w-0 wrap-anywhere text-xs font-normal text-muted"
    >{{ item.context }}</span>
  </ULink>
</template>
