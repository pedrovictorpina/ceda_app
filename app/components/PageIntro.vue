<script setup lang="ts">
defineProps<{ title: string, description: string, icon?: string }>()
</script>

<template>
  <h1 class="sr-only">
    {{ title }}
  </h1>
</template>
