<script setup lang="ts">
import type { ChartTableRow, SectionStatus } from '~/utils/adminDashboard'

const props = withDefaults(defineProps<{
  title: string
  subtitle?: string
  icon: string
  status: SectionStatus
  message?: string
  refreshing?: boolean
  empty?: boolean
  emptyText?: string
  tableCaption?: string
  tableHeaders?: [string, string] | [string, string, string]
  tableRows?: ChartTableRow[]
}>(), {
  subtitle: '',
  message: '',
  refreshing: false,
  empty: false,
  emptyText: 'Sem dados no período.',
  tableCaption: '',
  tableHeaders: () => ['Período', 'Valor'],
  tableRows: () => []
})

const headingId = useId()
const showTable = computed(() => props.status === 'ready' && !props.empty && props.tableRows.length > 0)
</script>

<template>
  <UCard
    as="section"
    class="dash-viz min-w-0"
    :aria-labelledby="headingId"
    :ui="{ body: 'p-4 sm:p-5' }"
  >
    <div class="flex items-start gap-3">
      <div class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <UIcon
          :name="icon"
          class="size-5"
        />
      </div>
      <div class="min-w-0">
        <h3
          :id="headingId"
          class="text-base font-semibold leading-snug text-highlighted"
        >
          {{ title }}
        </h3>
        <p
          v-if="subtitle && status === 'ready' && !empty"
          class="mt-0.5 text-sm text-muted"
        >
          {{ subtitle }}
        </p>
      </div>
    </div>

    <div class="mt-4">
      <USkeleton
        v-if="status === 'loading'"
        class="h-48 w-full rounded-xl"
      />
      <div
        v-else-if="status !== 'ready' || empty"
        class="grid min-h-40 place-items-center rounded-xl border border-dashed border-default px-4 py-6 text-center"
      >
        <div>
          <UIcon
            :name="status === 'unavailable' ? 'i-lucide-database-zap' : status === 'error' ? 'i-lucide-circle-alert' : 'i-lucide-chart-no-axes-column'"
            class="mx-auto size-6"
            :class="status === 'error' ? 'text-error' : 'text-dimmed'"
          />
          <p class="mt-2 text-sm text-muted">
            {{ status === 'ready' ? emptyText : message }}
          </p>
        </div>
      </div>
      <div
        v-else
        class="transition-opacity"
        :class="refreshing ? 'opacity-50' : 'opacity-100'"
        :aria-busy="refreshing"
      >
        <slot />
      </div>
    </div>

    <details
      v-if="showTable"
      class="group mt-3 text-sm"
    >
      <summary class="focus-ring inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 rounded-lg font-medium text-muted hover:text-default">
        <UIcon
          name="i-lucide-table-2"
          class="size-4"
        />
        <span class="group-open:hidden">Ver dados em tabela</span>
        <span class="hidden group-open:inline">Ocultar tabela</span>
      </summary>
      <div class="mt-2 max-h-72 overflow-auto rounded-xl border border-default">
        <table class="w-full text-left text-sm tabular-nums">
          <caption class="sr-only">
            {{ tableCaption || title }}
          </caption>
          <thead class="sticky top-0 bg-elevated text-xs text-muted">
            <tr>
              <th
                v-for="(header, index) in tableHeaders"
                :key="header"
                scope="col"
                class="px-3 py-2 font-medium"
                :class="index > 0 ? 'text-right' : ''"
              >
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr
              v-for="row in tableRows"
              :key="row.key"
            >
              <th
                scope="row"
                class="px-3 py-2 font-normal"
              >
                {{ row.label }}
              </th>
              <td class="px-3 py-2 text-right font-medium text-highlighted">
                {{ row.value }}
              </td>
              <td
                v-if="tableHeaders.length === 3"
                class="px-3 py-2 text-right text-muted"
              >
                {{ row.extra }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  </UCard>
</template>

<style>
/*
 * Cores dos gráficos do painel. A marca (#ea580c) passou no validador do
 * guia de visualização nos dois modos: faixa de luminosidade, croma e
 * contraste >= 3:1 sobre o cartão claro (#ffffff) e escuro (#18181b).
 */
.dash-viz {
  --viz-mark: #ea580c;
  --viz-grid: #e4e4e7;
  --viz-baseline: #d4d4d8;
  --viz-hover: rgb(24 24 27 / 0.05);
  --viz-track: #f4f4f5;
}

.dark .dash-viz {
  --viz-grid: #27272a;
  --viz-baseline: #3f3f46;
  --viz-hover: rgb(255 255 255 / 0.06);
  --viz-track: #27272a;
}

@media (forced-colors: active) {
  .dash-viz {
    --viz-mark: CanvasText;
    --viz-grid: GrayText;
    --viz-baseline: CanvasText;
  }
}
</style>
