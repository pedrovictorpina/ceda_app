<script setup lang="ts">
definePageMeta({ middleware: ['auth', 'operations'] })
useSeoMeta({ title: 'Relatórios da Loja' })

type OrderStatus = 'awaiting_payment' | 'ready_for_pickup' | 'fulfilled' | 'cancelled'
type Preset = 'day' | 'week' | 'month' | 'year' | 'custom'

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
  product: { name: string } | { name: string }[] | null
}

interface StoreOrder {
  id: string
  order_number: number
  status: OrderStatus
  total_amount: number
  created_at: string
  payment_method: 'cash' | 'pix' | 'debit_card' | 'credit_card' | null
  store_order_items: OrderItem[]
}

interface StoreProduct {
  id: string
  name: string
  stock_available: number
  active: boolean
}

interface InventoryBatch {
  id: string
  product_id: string
  quantity_on_hand: number
  expires_on: string | null
  product: { name: string } | { name: string }[] | null
}

interface CashDay {
  id: string
  business_date: string
  status: 'preparing' | 'open' | 'closed'
  started_at: string | null
  closed_at: string | null
}

const route = useRoute()
const selectedCashDayId = computed(() => typeof route.query.dia === 'string' ? route.query.dia : '')
const cashDay = ref<CashDay | null>(null)
const cashFlowAvailable = ref<boolean | null>(null)
const recentDays = ref<CashDay[]>([])
const paymentLabels = { cash: 'Dinheiro', pix: 'Pix', debit_card: 'Débito', credit_card: 'Crédito' }

const presets: Array<{ value: Preset, label: string }> = [
  { value: 'day', label: 'Hoje' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
  { value: 'year', label: 'Ano' },
  { value: 'custom', label: 'Personalizado' }
]

const statusLabels: Record<OrderStatus, string> = {
  awaiting_payment: 'Aguardando caixa',
  ready_for_pickup: 'Pronto para retirada',
  fulfilled: 'Entregue',
  cancelled: 'Cancelado'
}

const statusColors: Record<OrderStatus, 'warning' | 'success' | 'error' | 'neutral'> = {
  awaiting_payment: 'warning',
  ready_for_pickup: 'success',
  fulfilled: 'neutral',
  cancelled: 'error'
}

const statusBarClasses: Record<OrderStatus, string> = {
  awaiting_payment: 'bg-warning',
  ready_for_pickup: 'bg-success',
  fulfilled: 'bg-neutral',
  cancelled: 'bg-error'
}

const selectedPreset = ref<Preset>('month')
const startDate = ref('')
const endDate = ref('')
const orders = ref<StoreOrder[]>([])
const products = ref<StoreProduct[]>([])
const batches = ref<InventoryBatch[]>([])
const loading = ref(true)
const exporting = ref(false)
const feedback = ref('')
const reportPanel = ref<HTMLElement | null>(null)

function isoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function datesForPreset(preset: Preset) {
  const now = new Date()
  const start = new Date(now)
  const end = new Date(now)
  if (preset === 'day') return { start: isoDate(start), end: isoDate(end) }
  if (preset === 'week') {
    const weekday = start.getDay() || 7
    start.setDate(start.getDate() - weekday + 1)
    end.setDate(start.getDate() + 6)
  } else if (preset === 'month') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1, 0)
  } else if (preset === 'year') {
    start.setMonth(0, 1)
    end.setMonth(11, 31)
  }
  return { start: isoDate(start), end: isoDate(end) }
}

const effectiveDates = computed(() => {
  if (selectedPreset.value === 'custom') return { start: startDate.value, end: endDate.value }
  return datesForPreset(selectedPreset.value)
})

const rangeLabel = computed(() => {
  if (cashDay.value) return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${cashDay.value.business_date}T12:00:00Z`))
  const { start, end } = effectiveDates.value
  if (!start || !end) return 'Defina o período para consultar os dados.'
  const format = (date: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`))
  return `${format(start)} a ${format(end)}`
})

const statusCounts = computed(() => Object.fromEntries(
  (Object.keys(statusLabels) as OrderStatus[]).map(status => [status, orders.value.filter(order => order.status === status).length])
) as Record<OrderStatus, number>)

const paidOrders = computed(() => orders.value.filter(order => ['ready_for_pickup', 'fulfilled'].includes(order.status)))
const revenue = computed(() => paidOrders.value.reduce((total, order) => total + Number(order.total_amount), 0))
const revenueByMethod = computed(() => Object.fromEntries(
  Object.keys(paymentLabels).map(method => [method, paidOrders.value.filter(order => order.payment_method === method)
    .reduce((total, order) => total + Number(order.total_amount), 0)])
) as Record<keyof typeof paymentLabels, number>)
const averageTicket = computed(() => paidOrders.value.length ? revenue.value / paidOrders.value.length : 0)
const deliveredItems = computed(() => orders.value.filter(order => order.status === 'fulfilled').reduce((total, order) => total + order.store_order_items.reduce((sum, item) => sum + Number(item.quantity), 0), 0))
const pendingItems = computed(() => orders.value.filter(order => ['awaiting_payment', 'ready_for_pickup'].includes(order.status)).reduce((total, order) => total + order.store_order_items.reduce((sum, item) => sum + Number(item.quantity), 0), 0))
const cancelledItems = computed(() => orders.value.filter(order => order.status === 'cancelled').reduce((total, order) => total + order.store_order_items.reduce((sum, item) => sum + Number(item.quantity), 0), 0))

const bestSellers = computed(() => {
  const rows = new Map<string, { name: string, quantity: number, revenue: number }>()
  for (const order of orders.value.filter(order => ['ready_for_pickup', 'fulfilled'].includes(order.status))) {
    for (const item of order.store_order_items) {
      const name = relationName(item.product) || 'Produto removido'
      const row = rows.get(item.product_id) || { name, quantity: 0, revenue: 0 }
      row.quantity += Number(item.quantity)
      row.revenue += Number(item.quantity) * Number(item.unit_price)
      rows.set(item.product_id, row)
    }
  }
  return [...rows.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 6)
})

const lowStock = computed(() => products.value.filter(product => product.active && Number(product.stock_available) <= 5).sort((a, b) => Number(a.stock_available) - Number(b.stock_available)))
const expiringBatches = computed(() => {
  const limit = new Date()
  limit.setDate(limit.getDate() + 30)
  const limitDate = isoDate(limit)
  return batches.value.filter(batch => batch.expires_on && batch.expires_on >= isoDate(new Date()) && batch.expires_on <= limitDate && Number(batch.quantity_on_hand) > 0)
    .sort((a, b) => String(a.expires_on).localeCompare(String(b.expires_on)))
})

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function relationName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(value)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
}

function setPreset(preset: Preset) {
  selectedPreset.value = preset
  if (preset !== 'custom') void loadReport()
}

async function loadReport() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    feedback.value = 'O serviço de dados não está configurado neste ambiente.'
    loading.value = false
    return
  }
  const { start, end } = effectiveDates.value
  if (!start || !end || start > end) {
    feedback.value = 'Informe uma data inicial e uma data final válidas.'
    return
  }

  loading.value = true
  feedback.value = ''
  if (cashFlowAvailable.value === null) {
    const { error } = await $supabase.rpc('sync_store_cash_day')
    cashFlowAvailable.value = !error
  } else if (cashFlowAvailable.value) await $supabase.rpc('sync_store_cash_day')
  if (selectedCashDayId.value && !cashFlowAvailable.value) {
    feedback.value = 'O relatório por dia estará disponível após a atualização do banco.'
    loading.value = false
    return
  }
  if (selectedCashDayId.value) {
    const dayResult = await $supabase.from('store_cash_days')
      .select('id, business_date, status, started_at, closed_at').eq('id', selectedCashDayId.value).maybeSingle()
    cashDay.value = dayResult.data as CashDay | null
    if (dayResult.error || !cashDay.value) {
      feedback.value = 'Não foi possível localizar este dia de caixa.'
      loading.value = false
      return
    }
  } else cashDay.value = null
  const endTimestamp = `${end}T23:59:59.999`
  const ordersQuery = cashFlowAvailable.value
    ? $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at, payment_method, store_order_items(product_id, quantity, unit_price, product:store_products(name))')
    : $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at, store_order_items(product_id, quantity, unit_price, product:store_products(name))')
  const filteredOrdersQuery = cashDay.value
    ? ordersQuery.eq('cash_day_id', cashDay.value.id)
    : ordersQuery.gte('created_at', `${start}T00:00:00`).lte('created_at', endTimestamp)
  const [ordersResult, productsResult, batchesResult] = await Promise.all([
    filteredOrdersQuery.order('created_at', { ascending: false }).limit(1000),
    $supabase.from('store_products').select('id, name, stock_available, active').order('name'),
    $supabase.from('inventory_batches').select('id, product_id, quantity_on_hand, expires_on, product:store_products(name)').gt('quantity_on_hand', 0).not('expires_on', 'is', null).order('expires_on')
  ])
  orders.value = ((ordersResult.data || []) as unknown as StoreOrder[]).map(order => ({ ...order, payment_method: order.payment_method || null }))
  products.value = (productsResult.data || []) as StoreProduct[]
  batches.value = (batchesResult.data || []) as InventoryBatch[]
  feedback.value = ordersResult.error || productsResult.error || batchesResult.error
    ? 'Não foi possível carregar todos os dados do relatório. Confirme sua permissão de operação.'
    : ''
  loading.value = false
}

async function loadRecentDays() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashFlowAvailable.value) return
  const { data } = await $supabase.from('store_cash_days')
    .select('id, business_date, status, started_at, closed_at')
    .eq('status', 'closed').order('business_date', { ascending: false }).limit(8)
  recentDays.value = (data || []) as CashDay[]
}

function csvCell(value: string | number) {
  const cell = String(value)
  const safeCell = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
  return `"${safeCell.replaceAll('"', '""')}"`
}

function downloadFile(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

function exportCsv() {
  const header = ['Pedido', 'Data', 'Status', 'Pagamento', 'Produtos', 'Quantidade', 'Total']
  const rows = orders.value.map(order => [
    order.order_number,
    formatDateTime(order.created_at),
    statusLabels[order.status],
    order.payment_method ? paymentLabels[order.payment_method] : '',
    order.store_order_items.map(item => relationName(item.product) || 'Produto removido').join(' | '),
    order.store_order_items.reduce((total, item) => total + Number(item.quantity), 0),
    Number(order.total_amount).toFixed(2).replace('.', ',')
  ])
  const csv = `\uFEFF${[header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}`
  downloadFile(csv, `relatorio-caixa-${cashDay.value?.business_date || effectiveDates.value.start || 'periodo'}.csv`, 'text/csv;charset=utf-8')
}

async function exportPng() {
  exporting.value = true
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1600
    canvas.height = 1140
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível')
    context.fillStyle = '#17171b'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = '#ff8500'
    context.fillRect(0, 0, canvas.width, 14)
    context.fillStyle = '#ffffff'
    context.font = 'bold 46px sans-serif'
    context.fillText('CEDA · Relatório da Loja', 72, 96)
    context.fillStyle = '#c6c7cd'
    context.font = '28px sans-serif'
    context.fillText(rangeLabel.value, 72, 142)
    const metrics: Array<[string, string]> = [
      ['Faturamento confirmado', formatMoney(revenue.value)],
      ['Pedidos no período', String(orders.value.length)],
      ['Ticket médio', formatMoney(averageTicket.value)],
      ['Itens entregues', formatQuantity(deliveredItems.value)]
    ]
    metrics.forEach(([label, value], index) => {
      const x = 72 + index * 380
      context.fillStyle = '#24242a'
      context.fillRect(x, 205, 330, 150)
      context.fillStyle = '#b8bac3'
      context.font = '22px sans-serif'
      context.fillText(label, x + 24, 250)
      context.fillStyle = '#ffffff'
      context.font = 'bold 34px sans-serif'
      context.fillText(value, x + 24, 308)
    })
    context.fillStyle = '#ffffff'
    context.font = 'bold 30px sans-serif'
    context.fillText('Pedidos por status', 72, 434)
    ;(Object.keys(statusLabels) as OrderStatus[]).forEach((status, index) => {
      const y = 480 + index * 58
      context.fillStyle = '#2b2b32'
      context.fillRect(72, y - 30, 580, 42)
      context.fillStyle = '#ff8500'
      context.fillRect(72, y - 30, Math.min(500, statusCounts.value[status] * 70), 42)
      context.fillStyle = '#ffffff'
      context.font = '22px sans-serif'
      context.fillText(`${statusLabels[status]}: ${statusCounts.value[status]}`, 90, y)
    })
    context.font = 'bold 30px sans-serif'
    context.fillText('Itens mais vendidos', 790, 434)
    bestSellers.value.slice(0, 6).forEach((item, index) => {
      const y = 486 + index * 58
      context.fillStyle = '#ececf0'
      context.font = '24px sans-serif'
      context.fillText(`${index + 1}. ${item.name}`, 790, y)
      context.fillStyle = '#ff9a2f'
      context.fillText(`${formatQuantity(item.quantity)} un. · ${formatMoney(item.revenue)}`, 1210, y)
    })
    context.fillStyle = '#ffffff'
    context.font = 'bold 30px sans-serif'
    context.fillText('Faturamento por pagamento', 72, 825)
    ;(Object.keys(paymentLabels) as Array<keyof typeof paymentLabels>).forEach((method, index) => {
      const x = 72 + index * 380
      context.fillStyle = '#24242a'
      context.fillRect(x, 850, 330, 125)
      context.fillStyle = '#b8bac3'
      context.font = '22px sans-serif'
      context.fillText(paymentLabels[method], x + 20, 895)
      context.fillStyle = '#ffffff'
      context.font = 'bold 29px sans-serif'
      context.fillText(formatMoney(revenueByMethod.value[method]), x + 20, 943)
    })
    context.fillStyle = '#b8bac3'
    context.font = '22px sans-serif'
    context.fillText(`Estoque baixo: ${lowStock.value.length} · Validade em até 30 dias: ${expiringBatches.value.length}`, 72, 1030)
    context.fillText(`Gerado em ${formatDateTime(new Date().toISOString())}`, 72, 1074)
    await new Promise<void>((resolve, reject) => canvas.toBlob(blob => blob ? (downloadFile(blob, `relatorio-caixa-${cashDay.value?.business_date || effectiveDates.value.start || 'periodo'}.png`, 'image/png'), resolve()) : reject(new Error('Não foi possível gerar a imagem')), 'image/png'))
  } catch {
    feedback.value = 'Não foi possível gerar a imagem do relatório neste navegador.'
  } finally {
    exporting.value = false
  }
}

onMounted(async () => {
  await loadReport()
  await loadRecentDays()
})
watch(selectedCashDayId, () => {
  void loadReport()
})
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="exporting"
      label="Exportando relatório…"
    />
    <PageIntro
      :title="cashDay ? 'Fechamento do caixa' : 'Relatórios da Loja'"
      description="Acompanhe vendas, formas de pagamento, fila de pedidos e riscos de estoque. O faturamento considera pedidos confirmados ou entregues."
      icon="i-lucide-chart-no-axes-combined"
    />

    <div
      v-if="recentDays.length"
      class="mb-5 flex flex-wrap items-center gap-2"
    >
      <span class="mr-1 text-sm font-medium text-muted">Dias de caixa:</span>
      <UButton
        v-for="day in recentDays"
        :key="day.id"
        :to="`/operacao/relatorios?dia=${day.id}`"
        :label="new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${day.business_date}T12:00:00Z`))"
        :color="selectedCashDayId === day.id ? 'primary' : 'neutral'"
        :variant="selectedCashDayId === day.id ? 'solid' : 'outline'"
        size="sm"
      />
      <UButton
        v-if="selectedCashDayId"
        to="/operacao/relatorios"
        label="Outros períodos"
        color="neutral"
        variant="ghost"
        size="sm"
      />
    </div>

    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando relatórios…"
    />

    <section class="rounded-2xl border border-default bg-elevated/30 p-4 shadow-sm sm:p-5">
      <div class="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Período de análise
          </p>
          <div
            v-if="!cashDay"
            class="mt-3 flex flex-wrap gap-2"
          >
            <UButton
              v-for="preset in presets"
              :key="preset.value"
              :label="preset.label"
              :color="selectedPreset === preset.value ? 'primary' : 'neutral'"
              :variant="selectedPreset === preset.value ? 'solid' : 'outline'"
              size="sm"
              @click="setPreset(preset.value)"
            />
          </div>
          <p class="mt-3 flex items-center gap-2 text-sm text-muted">
            <UIcon
              name="i-lucide-calendar-range"
              class="size-4 text-primary"
            />
            {{ rangeLabel }}
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <UFormField
            v-if="!cashDay && selectedPreset === 'custom'"
            label="Data inicial"
          >
            <AppDatePicker v-model="startDate" />
          </UFormField>
          <UFormField
            v-if="!cashDay && selectedPreset === 'custom'"
            label="Data final"
          >
            <AppDatePicker v-model="endDate" />
          </UFormField>
          <UButton
            v-if="!cashDay && selectedPreset === 'custom'"
            label="Aplicar"
            icon="i-lucide-filter"
            :loading="loading"
            @click="loadReport"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            aria-label="Atualizar relatório"
            @click="loadReport"
          />
        </div>
      </div>
      <div class="mt-4 border-t border-default pt-3 text-xs leading-5 text-muted">
        Os indicadores consideram o período selecionado. Pedidos aguardando caixa continuam visíveis, mas só entram no faturamento após a confirmação.
      </div>
    </section>

    <UAlert
      v-if="feedback"
      class="mt-5"
      color="warning"
      variant="subtle"
      :description="feedback"
    />

    <section
      ref="reportPanel"
      class="mt-6"
      aria-labelledby="store-report-title"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Resumo operacional
          </p>
          <h2
            id="store-report-title"
            class="mt-1 text-2xl font-bold"
          >
            {{ cashDay ? 'Indicadores do caixa' : 'Indicadores do período' }}
          </h2>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Exportar planilha"
            icon="i-lucide-sheet"
            :disabled="!orders.length"
            @click="exportCsv"
          />
          <UButton
            color="neutral"
            variant="outline"
            label="Exportar imagem"
            icon="i-lucide-image-down"
            :loading="exporting"
            @click="exportPng"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <USkeleton
          v-for="item in 4"
          :key="item"
          class="h-32 rounded-xl"
        />
      </div>
      <template v-else>
        <div class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <UCard class="overflow-hidden">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm text-muted">
                Faturamento confirmado
              </p><div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-circle-dollar-sign"
                  class="size-4"
                />
              </div>
            </div><p class="mt-3 text-3xl font-bold text-primary">
              {{ formatMoney(revenue) }}
            </p><p class="mt-2 text-xs text-muted">
              Pagos no caixa ou entregues
            </p>
          </UCard>
          <UCard class="overflow-hidden">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm text-muted">
                Pedidos no período
              </p><div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-receipt-text"
                  class="size-4"
                />
              </div>
            </div><p class="mt-3 text-3xl font-bold">
              {{ orders.length }}
            </p><p class="mt-2 text-xs text-muted">
              Inclui cancelados
            </p>
          </UCard>
          <UCard class="overflow-hidden">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm text-muted">
                Ticket médio
              </p><div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-chart-column-increasing"
                  class="size-4"
                />
              </div>
            </div><p class="mt-3 text-3xl font-bold">
              {{ formatMoney(averageTicket) }}
            </p><p class="mt-2 text-xs text-muted">
              Sobre pedidos confirmados
            </p>
          </UCard>
          <UCard class="overflow-hidden">
            <div class="flex items-start justify-between gap-3">
              <p class="text-sm text-muted">
                Itens entregues
              </p><div class="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-package-check"
                  class="size-4"
                />
              </div>
            </div><p class="mt-3 text-3xl font-bold">
              {{ formatQuantity(deliveredItems) }}
            </p><p class="mt-2 text-xs text-muted">
              {{ formatQuantity(pendingItems) }} pendentes · {{ formatQuantity(cancelledItems) }} cancelados
            </p>
          </UCard>
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-2">
          <UCard v-if="cashFlowAvailable">
            <template #header>
              <h3 class="font-semibold">
                Faturamento por pagamento
              </h3>
            </template>
            <div class="space-y-4">
              <div
                v-for="(label, method) in paymentLabels"
                :key="method"
              >
                <div class="flex justify-between text-sm">
                  <span>{{ label }}</span><strong>{{ formatMoney(revenueByMethod[method]) }}</strong>
                </div>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary"
                    :style="{ width: `${revenue ? revenueByMethod[method] / revenue * 100 : 0}%` }"
                  />
                </div>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header>
              <div>
                <h3 class="font-semibold">
                  Pedidos por status
                </h3><p class="mt-1 text-sm text-muted">
                  Situação de todos os pedidos do período.
                </p>
              </div>
            </template>
            <div class="space-y-4">
              <div
                v-for="status in (Object.keys(statusLabels) as OrderStatus[])"
                :key="status"
              >
                <div class="flex items-center justify-between text-sm">
                  <span class="flex items-center gap-2"><span
                    class="size-2 rounded-full"
                    :class="statusBarClasses[status]"
                  />{{ statusLabels[status] }}</span><strong>{{ statusCounts[status] }}</strong>
                </div>
                <div class="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    class="h-full rounded-full transition-all"
                    :class="statusBarClasses[status]"
                    :style="{ width: `${orders.length ? (statusCounts[status] / orders.length) * 100 : 0}%` }"
                  />
                </div>
              </div>
            </div>
          </UCard>
          <UCard>
            <template #header>
              <div>
                <h3 class="font-semibold">
                  Itens mais vendidos
                </h3><p class="mt-1 text-sm text-muted">
                  Pedidos já confirmados ou entregues.
                </p>
              </div>
            </template>
            <div
              v-if="bestSellers.length"
              class="space-y-4"
            >
              <div
                v-for="(item, index) in bestSellers"
                :key="item.name"
                class="flex items-center gap-3"
              >
                <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">{{ index + 1 }}</span><div class="min-w-0 flex-1">
                  <p class="truncate font-medium">
                    {{ item.name }}
                  </p><p class="text-sm text-muted">
                    {{ formatQuantity(item.quantity) }} un. · {{ formatMoney(item.revenue) }}
                  </p>
                </div>
              </div>
            </div>
            <p
              v-else
              class="py-6 text-center text-sm text-muted"
            >
              Ainda não há vendas confirmadas no período.
            </p>
          </UCard>
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-2">
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-package-x"
                  class="size-5 text-warning"
                /><div>
                  <h3 class="font-semibold">
                    Estoque baixo
                  </h3><p class="mt-1 text-sm text-muted">
                    Produtos ativos com até 5 unidades disponíveis.
                  </p>
                </div>
              </div>
            </template>
            <div
              v-if="lowStock.length"
              class="space-y-3"
            >
              <div
                v-for="product in lowStock"
                :key="product.id"
                class="flex items-center justify-between rounded-lg bg-elevated/60 p-3"
              >
                <span class="font-medium">{{ product.name }}</span><UBadge
                  color="warning"
                  variant="subtle"
                  :label="`${formatQuantity(product.stock_available)} un.`"
                />
              </div>
            </div>
            <p
              v-else
              class="py-6 text-center text-sm text-muted"
            >
              Nenhum produto ativo está em estoque baixo.
            </p>
          </UCard>
          <UCard>
            <template #header>
              <div class="flex items-center gap-2">
                <UIcon
                  name="i-lucide-calendar-clock"
                  class="size-5 text-warning"
                /><div>
                  <h3 class="font-semibold">
                    Validade próxima
                  </h3><p class="mt-1 text-sm text-muted">
                    Lotes com saldo e vencimento nos próximos 30 dias.
                  </p>
                </div>
              </div>
            </template>
            <div
              v-if="expiringBatches.length"
              class="space-y-3"
            >
              <div
                v-for="batch in expiringBatches"
                :key="batch.id"
                class="flex items-center justify-between gap-3 rounded-lg bg-elevated/60 p-3"
              >
                <div>
                  <p class="font-medium">
                    {{ relationName(batch.product) || 'Produto' }}
                  </p><p class="text-sm text-muted">
                    {{ formatQuantity(batch.quantity_on_hand) }} un. em saldo
                  </p>
                </div><UBadge
                  color="warning"
                  variant="subtle"
                  :label="new Intl.DateTimeFormat('pt-BR').format(new Date(`${batch.expires_on}T00:00:00`))"
                />
              </div>
            </div>
            <p
              v-else
              class="py-6 text-center text-sm text-muted"
            >
              Nenhum lote com validade próxima.
            </p>
          </UCard>
        </div>

        <UCard class="mt-6 overflow-hidden">
          <template #header>
            <div>
              <h3 class="font-semibold">
                Pedidos do período
              </h3><p class="mt-1 text-sm text-muted">
                Até 1.000 pedidos para preservar a resposta e a exportação no navegador.
              </p>
            </div>
          </template>
          <div
            v-if="orders.length"
            class="overflow-x-auto"
          >
            <table class="min-w-[48rem] text-left text-sm">
              <thead class="border-b border-default text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th class="px-2 py-3 font-medium">
                    Pedido
                  </th><th class="px-2 py-3 font-medium">
                    Data
                  </th><th class="px-2 py-3 font-medium">
                    Itens
                  </th><th class="px-2 py-3 font-medium">
                    Status
                  </th><th class="px-2 py-3 text-right font-medium">
                    Total
                  </th>
                </tr>
              </thead><tbody>
                <tr
                  v-for="order in orders"
                  :key="order.id"
                  class="border-b border-default/60 transition-colors hover:bg-elevated/60 last:border-0"
                >
                  <td class="px-2 py-3 font-semibold">
                    #{{ order.order_number }}
                  </td><td class="whitespace-nowrap px-2 py-3 text-muted">
                    {{ formatDateTime(order.created_at) }}
                  </td><td class="max-w-72 px-2 py-3 text-muted">
                    {{ order.store_order_items.map(item => `${relationName(item.product) || 'Produto'} × ${formatQuantity(item.quantity)}`).join(', ') }}
                  </td><td class="px-2 py-3">
                    <UBadge
                      :color="statusColors[order.status]"
                      variant="subtle"
                      :label="statusLabels[order.status]"
                    />
                  </td><td class="whitespace-nowrap px-2 py-3 text-right font-semibold">
                    {{ formatMoney(order.total_amount) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p
            v-else
            class="py-8 text-center text-sm text-muted"
          >
            Nenhum pedido encontrado neste período.
          </p>
        </UCard>
      </template>
    </section>
  </div>
</template>
