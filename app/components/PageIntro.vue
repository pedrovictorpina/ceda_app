<script setup lang="ts">
defineProps<{ title: string, description: string, icon?: string }>()
</script>

<template>
  <header class="relative mb-8 overflow-hidden rounded-2xl border border-default bg-gradient-to-br from-primary/10 via-default to-default p-5 sm:p-7">
    <div class="pointer-events-none absolute -right-16 -top-20 size-52 rounded-full bg-primary/10 blur-3xl" />
    <div class="relative flex items-start gap-4">
      <div
        v-if="icon"
        class="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20"
      >
        <UIcon
          :name="icon"
          class="size-6"
        />
      </div>
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">
          {{ title }}
        </h1><p class="mt-1 max-w-3xl text-muted">
          {{ description }}
        </p>
      </div>
    </div>
  </header>
</template>
