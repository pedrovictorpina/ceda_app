<script setup lang="ts">
const props = defineProps<{ quantity: number, max: number, name: string, size?: 'sm' | 'md' }>()
const emit = defineEmits<{ change: [quantity: number] }>()

const buttonSize = computed(() => props.size === 'sm' ? 'size-10' : 'size-11')
</script>

<template>
  <div
    class="inline-flex items-center rounded-full bg-primary/10 p-0.5 text-primary ring-1 ring-primary/20"
    role="group"
    :aria-label="`Quantidade de ${name}`"
  >
    <UButton
      color="primary"
      variant="ghost"
      type="button"
      class="focus-ring grid shrink-0 place-items-center rounded-full transition active:scale-90 hover:bg-primary/15"
      :class="buttonSize"
      :aria-label="quantity === 1 ? `Remover ${name}` : `Diminuir ${name}`"
      @click="emit('change', quantity - 1)"
    >
      <UIcon
        :name="quantity === 1 ? 'i-lucide-trash-2' : 'i-lucide-minus'"
        class="size-4"
      />
    </UButton>
    <span
      class="min-w-7 text-center text-base font-bold tabular-nums text-highlighted"
      aria-live="polite"
    >{{ quantity }}</span>
    <UButton
      color="primary"
      variant="solid"
      type="button"
      class="focus-ring grid shrink-0 place-items-center rounded-full bg-primary text-inverted shadow-sm transition active:scale-90 disabled:cursor-not-allowed disabled:bg-primary/30 disabled:shadow-none"
      :class="buttonSize"
      :disabled="quantity >= max"
      :aria-label="`Aumentar ${name}`"
      @click="emit('change', quantity + 1)"
    >
      <UIcon
        name="i-lucide-plus"
        class="size-4"
      />
    </UButton>
  </div>
</template>
