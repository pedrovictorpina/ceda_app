<script setup lang="ts">
import { formatBRL } from '~/utils/storeCart'
import type { ChildrenData, MembersData, StoreSalesData } from '~/composables/useAdminDashboardSources'
import { formatCompactBRL, formatCount, type ChartTableRow, type SectionState } from '~/utils/adminDashboard'
import {
  checkinsTakeaway,
  membersTakeaway,
  productsTakeaway,
  revenueTakeaway,
  seriesSubtitle,
  seriesSummary
} from '~/utils/adminDashboardCopy'
import { isEmptySeries, type DashboardPeriod, type SeriesPoint } from '~/utils/adminDashboardDates'

const props = defineProps<{
  period: DashboardPeriod
  members: SectionState<MembersData>
  sales: SectionState<StoreSalesData>
  children: SectionState<ChildrenData>
}>()

const money = (value: number) => formatBRL(value)
const count = (value: number) => formatCount(value)

function rows(points: readonly SeriesPoint[], format: (value: number) => string): ChartTableRow[] {
  return points.map(point => ({ key: point.key, label: point.fullLabel, value: format(point.value) }))
}

const membersChart = computed(() => {
  const data = props.members.data
  if (!data) return null
  return {
    title: membersTakeaway(data.newInPeriod, data.change, props.period),
    subtitle: seriesSubtitle(data.series, data.granularity, props.period, count),
    summary: `Novos cadastros. ${seriesSummary(data.series, count)}`,
    rows: rows(data.series, count),
    empty: isEmptySeries(data.series)
  }
})

const salesChart = computed(() => {
  const data = props.sales.data
  if (!data) return null
  return {
    title: revenueTakeaway(data.revenue, data.change, props.period),
    subtitle: seriesSubtitle(data.series, data.granularity, props.period, money),
    summary: `Vendas confirmadas da loja. ${seriesSummary(data.series, money)}`,
    rows: rows(data.series, money),
    empty: isEmptySeries(data.series)
  }
})

const productsChart = computed(() => {
  const data = props.sales.data
  if (!data) return null
  return {
    title: productsTakeaway(data.ranking, props.period),
    rows: data.ranking.map(item => ({ key: item.id, label: item.name, value: formatCount(item.quantity), extra: formatBRL(item.revenue) }))
  }
})

const childrenChart = computed(() => {
  const data = props.children.data
  if (!data) return null
  return {
    title: checkinsTakeaway(data.total, props.period),
    subtitle: seriesSubtitle(data.series, data.granularity, props.period, count),
    summary: `Check-ins no Sementinhas. ${seriesSummary(data.series, count)}`,
    rows: rows(data.series, count),
    empty: isEmptySeries(data.series)
  }
})
</script>

<template>
  <section aria-labelledby="dashboard-charts-title">
    <h2
      id="dashboard-charts-title"
      class="text-lg font-semibold text-highlighted"
    >
      Tendências
    </h2>
    <p class="mt-0.5 text-sm text-muted">
      Últimos {{ period }} dias, no horário de Brasília.
    </p>

    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <AdminDashboardChartCard
        :title="membersChart?.title ?? 'Novos cadastros'"
        :subtitle="membersChart?.subtitle"
        icon="i-lucide-user-round-plus"
        :status="members.status"
        :message="members.message"
        :refreshing="members.refreshing"
        :empty="membersChart?.empty"
        empty-text="Quando novas pessoas se cadastrarem, a evolução aparece aqui."
        :table-headers="['Período', 'Cadastros']"
        :table-rows="membersChart?.rows"
      >
        <AdminDashboardColumnChart
          v-if="membersChart"
          :points="members.data?.series ?? []"
          :summary="membersChart.summary"
          :format="count"
        />
      </AdminDashboardChartCard>

      <AdminDashboardChartCard
        :title="salesChart?.title ?? 'Vendas da loja'"
        :subtitle="salesChart?.subtitle"
        icon="i-lucide-wallet"
        :status="sales.status"
        :message="sales.message"
        :refreshing="sales.refreshing"
        :empty="salesChart?.empty"
        empty-text="Nenhum pedido pago ou entregue neste período."
        :table-headers="['Período', 'Vendas']"
        :table-rows="salesChart?.rows"
      >
        <AdminDashboardColumnChart
          v-if="salesChart"
          :points="sales.data?.series ?? []"
          :summary="salesChart.summary"
          :format="money"
          :axis-format="formatCompactBRL"
          :integer="false"
        />
      </AdminDashboardChartCard>

      <AdminDashboardChartCard
        :title="productsChart?.title ?? 'Produtos mais vendidos'"
        :subtitle="`Top 5 por unidades, últimos ${period} dias.`"
        icon="i-lucide-trophy"
        :status="sales.status"
        :message="sales.message"
        :refreshing="sales.refreshing"
        :empty="!productsChart?.rows.length"
        empty-text="Os produtos vendidos no período aparecem aqui."
        :table-headers="['Produto', 'Unidades', 'Receita']"
        :table-rows="productsChart?.rows"
      >
        <AdminDashboardRankList :items="sales.data?.ranking ?? []" />
      </AdminDashboardChartCard>

      <AdminDashboardChartCard
        v-if="children.status !== 'hidden'"
        :title="childrenChart?.title ?? 'Check-ins no Sementinhas'"
        :subtitle="childrenChart?.subtitle"
        icon="i-lucide-sprout"
        :status="children.status"
        :message="children.message"
        :refreshing="children.refreshing"
        :empty="childrenChart?.empty"
        empty-text="Os check-ins das turmas infantis aparecem aqui."
        :table-headers="['Período', 'Check-ins']"
        :table-rows="childrenChart?.rows"
      >
        <AdminDashboardColumnChart
          v-if="childrenChart"
          :points="children.data?.series ?? []"
          :summary="childrenChart.summary"
          :format="count"
        />
      </AdminDashboardChartCard>
    </div>
  </section>
</template>
