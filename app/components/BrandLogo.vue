<script setup lang="ts">
const props = withDefaults(defineProps<{
  to?: string
  variant?: 'header' | 'auth'
}>(), {
  to: '/',
  variant: 'header'
})
</script>

<template>
  <NuxtLink
    :to="props.to"
    class="focus-ring inline-flex items-center rounded-md"
    :class="props.variant === 'auth' ? 'flex-col gap-2 text-center' : 'gap-2'"
    aria-label="CEDA — página inicial"
  >
    <img
      src="/brand/ceda-logo.jpg"
      alt="Logo da CEDA"
      width="150"
      height="150"
      class="shrink-0 rounded-full object-cover"
      :class="props.variant === 'auth' ? 'size-16 shadow-md' : 'size-10'"
    >
    <span
      class="font-semibold"
      :class="props.variant === 'auth' ? 'text-lg' : ''"
    >CEDA</span>
  </NuxtLink>
</template>
