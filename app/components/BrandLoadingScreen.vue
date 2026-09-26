<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Preparando sua experiência…' })
</script>

<template>
  <div class="fixed inset-0 z-[100] grid place-items-center bg-default/95 px-6 backdrop-blur-sm">
    <BrandLoader
      size="lg"
      :label="label"
    />
  </div>
</template>
