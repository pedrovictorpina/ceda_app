<script setup lang="ts">
import { DASHBOARD_PERIODS, type DashboardPeriod } from '~/utils/adminDashboardDates'

const props = defineProps<{
  period: DashboardPeriod
  updatedAt: Date | null
  refreshing: boolean
}>()

const emit = defineEmits<{
  'update:period': [value: DashboardPeriod]
  'refresh': []
}>()

const clock = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' })
const updatedLabel = computed(() => (props.updatedAt ? `Atualizado às ${clock.format(props.updatedAt)}` : 'Carregando…'))

function onKeydown(event: KeyboardEvent) {
  const index = DASHBOARD_PERIODS.indexOf(props.period)
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  const next = DASHBOARD_PERIODS[(index + step + DASHBOARD_PERIODS.length) % DASHBOARD_PERIODS.length]!
  emit('update:period', next)
  const target = (event.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-period="${next}"]`)
  target?.focus()
}
</script>

<template>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div
      role="radiogroup"
      aria-label="Período dos indicadores"
      class="inline-flex rounded-xl border border-default bg-elevated/60 p-1"
      @keydown="onKeydown"
    >
      <button
        v-for="option in DASHBOARD_PERIODS"
        :key="option"
        type="button"
        role="radio"
        :data-period="option"
        :aria-checked="option === period"
        :tabindex="option === period ? 0 : -1"
        class="focus-ring min-h-11 rounded-lg px-3.5 text-sm font-semibold transition sm:px-4"
        :class="option === period ? 'bg-default text-highlighted shadow-sm ring-1 ring-default' : 'text-muted hover:text-default'"
        @click="emit('update:period', option)"
      >
        {{ option }} dias
      </button>
    </div>

    <div class="flex items-center gap-2">
      <span
        class="text-sm text-muted max-sm:sr-only"
        aria-live="polite"
      >{{ refreshing ? 'Atualizando…' : updatedLabel }}</span>
      <UButton
        color="neutral"
        variant="outline"
        icon="i-lucide-refresh-cw"
        class="size-11 justify-center"
        :loading="refreshing"
        aria-label="Atualizar painel"
        @click="emit('refresh')"
      />
    </div>
  </div>
</template>
