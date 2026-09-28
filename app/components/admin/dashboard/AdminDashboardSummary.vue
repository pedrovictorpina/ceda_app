<script setup lang="ts">
import type {
  BirthdaysData,
  CellsData,
  ChildrenData,
  EventsData,
  MembersData,
  StoreSalesData
} from '~/composables/useAdminDashboardSources'
import {
  changeTone,
  describeChange,
  formatCount,
  listPreview,
  plural,
  type SectionState,
  type SectionStatus,
  type TileTone
} from '~/utils/adminDashboard'
import type { DashboardPeriod } from '~/utils/adminDashboardDates'
import { formatBRL } from '~/utils/storeCart'

const props = defineProps<{
  period: DashboardPeriod
  members: SectionState<MembersData>
  sales: SectionState<StoreSalesData>
  events: SectionState<EventsData>
  cells: SectionState<CellsData>
  children: SectionState<ChildrenData>
  birthdays: SectionState<BirthdaysData>
  urgent: number
  attentionAreas: number
  attentionLoading: boolean
}>()

interface Tile {
  id: string
  label: string
  icon: string
  to: string
  status: SectionStatus
  message: string
  refreshing: boolean
  value?: string
  detail?: string
  tone?: TileTone
}

function base<T>(section: SectionState<T>) {
  return { status: section.status, message: section.message, refreshing: section.refreshing }
}

function membersTile(): Tile {
  const data = props.members.data
  return {
    id: 'members',
    label: 'Membros',
    icon: 'i-lucide-users-round',
    to: '/admin/pessoas',
    ...base(props.members),
    value: formatCount(data?.total),
    detail: data && data.newInPeriod > 0 ? `+${formatCount(data.newInPeriod)} em ${props.period} dias` : `Nenhum novo em ${props.period} dias`,
    tone: data && data.newInPeriod > 0 ? 'success' : 'neutral'
  }
}

function salesTile(): Tile {
  const data = props.sales.data
  return {
    id: 'sales',
    label: `Vendas em ${props.period} dias`,
    icon: 'i-lucide-wallet',
    to: '/operacao/relatorios',
    ...base(props.sales),
    value: data ? formatBRL(data.revenue) : undefined,
    detail: data ? describeChange(data.change, props.period, 'sem vendas') : '',
    tone: data ? changeTone(data.change) : 'neutral'
  }
}

function ordersTile(): Tile {
  const data = props.sales.data
  return {
    id: 'orders',
    label: `Pedidos em ${props.period} dias`,
    icon: 'i-lucide-receipt',
    to: '/operacao/relatorios',
    ...base(props.sales),
    value: formatCount(data?.orders),
    detail: data?.orders ? `Ticket médio de ${formatBRL(data.averageTicket)}` : `Nenhum pedido em ${props.period} dias`
  }
}

function pendingTile(): Tile {
  return {
    id: 'pending',
    label: 'Pendências',
    icon: 'i-lucide-list-todo',
    to: '#atencao',
    status: props.attentionLoading ? 'loading' : 'ready',
    message: '',
    refreshing: false,
    value: formatCount(props.urgent),
    detail: props.urgent > 0 ? `Pedem decisão em ${plural(props.attentionAreas, 'área', 'áreas')}` : 'Tudo em dia',
    tone: props.urgent > 0 ? 'warning' : 'success'
  }
}

function eventsTile(): Tile {
  const data = props.events.data
  return {
    id: 'events',
    label: 'Eventos em 30 dias',
    icon: 'i-lucide-calendar-days',
    to: '/admin/agenda',
    ...base(props.events),
    value: formatCount(data?.next30Days),
    detail: data ? `${formatCount(data.thisWeek.length)} nos próximos 7 dias` : ''
  }
}

function cellsTile(): Tile {
  const data = props.cells.data
  return {
    id: 'cells',
    label: 'Células ativas',
    icon: 'i-lucide-house-heart',
    to: '/celulas',
    ...base(props.cells),
    value: formatCount(data?.active),
    detail: data ? `${plural(data.participants, 'pessoa participando', 'pessoas participando')}` : ''
  }
}

function childrenTile(): Tile {
  const data = props.children.data
  return {
    id: 'children',
    label: 'Sementinhas hoje',
    icon: 'i-lucide-sprout',
    to: '/sementinhas/turmas',
    ...base(props.children),
    value: formatCount(data?.today),
    detail: data ? `${plural(data.total, 'check-in', 'check-ins')} em ${props.period} dias` : ''
  }
}

function birthdaysTile(): Tile {
  const data = props.birthdays.data
  return {
    id: 'birthdays',
    label: 'Aniversários da semana',
    icon: 'i-lucide-cake',
    to: '/aniversariantes',
    ...base(props.birthdays),
    value: formatCount(data?.count),
    detail: data?.count ? listPreview(data.names) : 'Ninguém nesta semana'
  }
}

const tiles = computed(() => [
  pendingTile(),
  membersTile(),
  salesTile(),
  ordersTile(),
  eventsTile(),
  cellsTile(),
  ...(props.children.status === 'hidden' ? [] : [childrenTile()]),
  birthdaysTile()
])
</script>

<template>
  <section aria-labelledby="dashboard-summary-title">
    <h2
      id="dashboard-summary-title"
      class="sr-only"
    >
      Resumo
    </h2>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <AdminDashboardStatTile
        v-for="tile in tiles"
        :key="tile.id"
        :label="tile.label"
        :icon="tile.icon"
        :to="tile.to"
        :status="tile.status"
        :message="tile.message"
        :refreshing="tile.refreshing"
        :value="tile.value"
        :detail="tile.detail"
        :tone="tile.tone"
      />
    </div>
  </section>
</template>
