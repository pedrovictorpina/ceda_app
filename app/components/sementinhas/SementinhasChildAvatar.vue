<script setup lang="ts">
import { childInitials } from '~/utils/childPhoto'

const props = withDefaults(defineProps<{ name: string, url?: string, size?: 'sm' | 'md' | 'lg' }>(), {
  url: '',
  size: 'md'
})

const sizeClass = computed(() => ({
  sm: 'size-10 text-sm',
  md: 'size-14 text-lg',
  lg: 'size-20 text-2xl'
})[props.size])
</script>

<template>
  <div
    class="grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-primary/10 font-bold text-primary"
    :class="sizeClass"
  >
    <img
      v-if="url"
      :src="url"
      :alt="`Foto de ${name}`"
      class="size-full object-cover"
      loading="lazy"
    >
    <span
      v-else
      aria-hidden="true"
    >{{ childInitials(name) }}</span>
  </div>
</template>
