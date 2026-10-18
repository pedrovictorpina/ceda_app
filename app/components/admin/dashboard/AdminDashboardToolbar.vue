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

const periods = DASHBOARD_PERIODS.map(value => ({ value, label: `${value} dias` }))

function onPeriodKeydown(event: KeyboardEvent) {
  const step = ['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 0
  if (!step) return
  event.preventDefault()
  const index = DASHBOARD_PERIODS.indexOf(props.period)
  emit('update:period', DASHBOARD_PERIODS[(index + step + DASHBOARD_PERIODS.length) % DASHBOARD_PERIODS.length]!)
}
</script>

<template>
  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <URadioGroup
      :model-value="period"
      :items="periods"
      orientation="horizontal"
      variant="table"
      indicator="hidden"
      loop
      aria-label="Período dos indicadores"
      :ui="{ fieldset: 'gap-0', item: 'min-h-11 px-3.5 sm:px-4', label: 'font-semibold' }"
      @update:model-value="emit('update:period', $event)"
      @keydown="onPeriodKeydown"
    />

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
