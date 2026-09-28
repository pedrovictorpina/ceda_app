<script setup lang="ts">
import type { DashboardShortcut } from '~/utils/adminDashboard'

defineProps<{ items: DashboardShortcut[] }>()
</script>

<template>
  <section aria-labelledby="dashboard-shortcuts-title">
    <h2
      id="dashboard-shortcuts-title"
      class="text-lg font-semibold text-highlighted"
    >
      Atalhos
    </h2>
    <p class="mt-0.5 text-sm text-muted">
      As tarefas mais comuns da gestão.
    </p>
    <ul class="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 xl:grid-cols-3">
      <li
        v-for="item in items"
        :key="item.id"
      >
        <NuxtLink
          :to="item.to"
          class="focus-ring group flex h-full min-h-22 flex-col items-center justify-center gap-2 rounded-2xl border border-default bg-default px-2 py-3 text-center shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
        >
          <span class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-white">
            <UIcon
              :name="item.icon"
              class="size-5"
            />
          </span>
          <span class="text-xs font-medium leading-4 text-default sm:text-sm sm:leading-5">{{ item.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
