<script setup lang="ts">
defineProps<{ title: string, description: string, icon?: string }>()
</script>

<template>
  <header class="sr-only">
    <h1>{{ title }}</h1>
    <p>{{ description }}</p>
  </header>
</template>
