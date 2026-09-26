<script setup lang="ts">
withDefaults(defineProps<{ label?: string }>(), { label: 'Salvando…' })
</script>

<template>
  <div class="fixed bottom-24 right-4 z-[90] flex items-center gap-3 rounded-2xl border border-default bg-default px-3 py-2 shadow-xl lg:bottom-6">
    <BrandLoader
      size="sm"
      :label="label"
    />
    <span class="text-sm font-medium text-default">{{ label }}</span>
  </div>
</template>
