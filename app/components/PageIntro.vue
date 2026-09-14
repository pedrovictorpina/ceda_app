<script setup lang="ts">
defineProps<{ title: string, description: string, icon?: string }>()
</script>

<template>
  <header class="mb-6 flex items-start gap-4">
    <div
      v-if="icon"
      class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"
    >
      <UIcon
        :name="icon"
        class="size-6"
      />
    </div>
    <div>
      <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
        {{ title }}
      </h1><p class="mt-1 max-w-3xl text-muted">
        {{ description }}
      </p>
    </div>
  </header>
</template>
