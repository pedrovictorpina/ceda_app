<script setup lang="ts">
import type { CellDirectoryFilters } from '~/types/cells'
import { WEEKDAY_SHORT } from '~/utils/cellDirectory'

const filters = defineModel<CellDirectoryFilters>({ required: true })

const weekdayOptions = [{ label: 'Todos', value: null as number | null }, ...WEEKDAY_SHORT.map((label, value) => ({ label, value: value as number | null }))]

function setWeekday(value: number | null) {
  filters.value = { ...filters.value, weekday: value }
}

function setSearch(value: string | number) {
  filters.value = { ...filters.value, search: String(value ?? '') }
}
</script>

<template>
  <div class="space-y-3">
    <UInput
      :model-value="filters.search"
      icon="i-lucide-search"
      size="xl"
      class="w-full"
      placeholder="Buscar por nome, bairro ou líder"
      aria-label="Buscar células"
      maxlength="60"
      @update:model-value="setSearch"
    />
    <div
      class="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      role="group"
      aria-label="Filtrar por dia do encontro"
    >
      <UButton
        v-for="option in weekdayOptions"
        :key="option.label"
        :color="filters.weekday === option.value ? 'primary' : 'neutral'"
        :variant="filters.weekday === option.value ? 'solid' : 'soft'"
        :aria-pressed="filters.weekday === option.value"
        :label="option.label"
        class="min-h-11 shrink-0 justify-center rounded-full px-4"
        @click="setWeekday(option.value)"
      />
    </div>
  </div>
</template>
