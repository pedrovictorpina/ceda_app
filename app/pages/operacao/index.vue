<script setup lang="ts">
import { canOperateStore } from '~/utils/authorization'
import { cashSelectionChanges } from '~/utils/storeCashSelection'
import type { StoreProduct } from '~/utils/storeCart'
import { displayOrderNumber } from '~/utils/storeOrderNumber'

definePageMeta({ middleware: ['auth', 'operations'] })
useSeoMeta({ title: 'Caixa e balcão' })

interface Product extends StoreProduct {
  id: string
  name: string
  stock_available: number
  active: boolean
}

interface StoreOrder {
  id: string
  order_number: number
  daily_order_number: number | null
  daily_order_date: string | null
  status: 'awaiting_payment' | 'ready_for_pickup'
  total_amount: number
  created_at: string
  note: string | null
  buyer_name: string | null
  order_source?: 'member' | 'counter'
  cash_day_id: string | null
  updated_at: string
  store_order_items: Array<{ product_id: string, quantity: number, unit_price: number, product: { name: string } | { name: string }[] | null }>
}

interface CashDay {
  id: string
  business_date: string
  status: 'preparing' | 'open' | 'closed'
  started_at: string | null
  auto_close_at: string | null
  closed_at: string | null
}

const auth = useAuthStore()
const products = ref<Product[]>([])
const orders = ref<StoreOrder[]>([])
const cashDay = ref<CashDay | null>(null)
const cashFlowAvailable = ref<boolean | null>(null)
const cashDayProductIds = ref<string[]>([])
const savedCashDayProductIds = ref<string[]>([])
const syncingProducts = ref(false)
const selectionAvailable = ref(false)
const closingMode = ref<'manual' | 'automatic'>('manual')
const autoCloseTime = ref('22:00')
const confirmingClose = ref(false)
const preparingCashOpen = ref(false)
const closeError = ref('')
const cancellingOrderId = ref<string | null>(null)
const fulfillingOrderId = ref<string | null>(null)
const paymentMethods = reactive<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)
const feedback = ref('')
const creatingOrder = ref(false)
const counterOrderBusy = ref(false)
const editingOrder = ref<StoreOrder | null>(null)
const editingOrderBusy = ref(false)

const canManageInventory = computed(() => canOperateStore(auth.profile))
const canConfirmOrders = canManageInventory
const canFulfillOrders = canManageInventory
const activeProducts = computed(() => products.value.filter(product => product.active))
const availableProducts = computed(() => activeProducts.value.filter(product => product.stock_available > 0))
const allProductsSelected = computed(() => availableProducts.value.length > 0 && availableProducts.value.every(product => cashDayProductIds.value.includes(product.id)))
const counterProducts = computed(() => activeProducts.value.filter(product => cashDayProductIds.value.includes(product.id) && product.stock_available >= 1))
const awaitingPaymentCount = computed(() => orders.value.filter(order => order.status === 'awaiting_payment').length)
const readyForPickupCount = computed(() => orders.value.filter(order => order.status === 'ready_for_pickup').length)
const actionableOrders = computed(() => orders.value.filter(order =>
  (order.status === 'awaiting_payment' && canConfirmOrders.value)
  || (order.status === 'ready_for_pickup' && canFulfillOrders.value)
))
const otherOrders = computed(() => orders.value.filter(order => !actionableOrders.value.includes(order)))
const visibleOrders = computed(() => canManageInventory.value
  ? [...actionableOrders.value, ...otherOrders.value]
  : actionableOrders.value)
const operationTitle = 'Caixa e balcão'
const operationDescription = 'Prepare os produtos do dia, confirme pagamentos e finalize a entrega dos pedidos liberados para retirada.'
const paymentOptions = [
  { label: 'Dinheiro', value: 'cash' },
  { label: 'Pix', value: 'pix' },
  { label: 'Cartão de débito', value: 'debit_card' },
  { label: 'Cartão de crédito', value: 'credit_card' }
]
const canStartCashDay = computed(() => selectionAvailable.value && !syncingProducts.value && availableProducts.value.some(product => cashDayProductIds.value.includes(product.id))
  && (closingMode.value === 'manual' || /^([01]\d|2[0-3]):[0-5]\d$/.test(autoCloseTime.value)))
const todayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date())
const todayPart = (type: string) => todayParts.find(part => part.type === type)?.value || ''
const todayInSaoPaulo = `${todayPart('year')}-${todayPart('month')}-${todayPart('day')}`
const isTodayCashDay = computed(() => cashDay.value?.business_date === todayInSaoPaulo)
let refreshTimer: ReturnType<typeof setInterval> | undefined
let selectionVersion = 0

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function relationName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name
}

async function loadOperation(silent = false) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  const version = selectionVersion
  if (!silent) loading.value = true
  if (cashFlowAvailable.value === null) {
    const { error } = await $supabase.rpc('sync_store_cash_day')
    cashFlowAvailable.value = !error
  } else if (cashFlowAvailable.value) await $supabase.rpc('sync_store_cash_day')
  const ordersQuery = cashFlowAvailable.value
    ? $supabase.from('store_orders').select('id, order_number, daily_order_number, daily_order_date, status, total_amount, created_at, updated_at, cash_day_id, note, buyer_name, order_source, store_order_items(product_id, quantity, unit_price, product:store_products(name))')
    : $supabase.from('store_orders').select('id, order_number, daily_order_number, daily_order_date, status, total_amount, created_at, updated_at, cash_day_id, note, store_order_items(product_id, quantity, unit_price, product:store_products(name))')
  const [productsResult, ordersResult, cashDayResult] = await Promise.all([
    $supabase.from('store_products').select('*').order('name'),
    ordersQuery.in('status', ['awaiting_payment', 'ready_for_pickup']).order('created_at'),
    cashFlowAvailable.value
      ? $supabase.from('store_cash_days').select('id, business_date, status, started_at, auto_close_at, closed_at').order('created_at', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])
  products.value = (productsResult.data || []) as Product[]
  orders.value = ((ordersResult.data || []) as unknown as StoreOrder[]).map(order => ({ ...order, buyer_name: order.buyer_name || null }))
  cashDay.value = cashDayResult.data as CashDay | null
  if (cashDay.value) {
    const selectionResult = await $supabase.from('store_cash_day_products').select('product_id').eq('cash_day_id', cashDay.value.id)
    if (!selectionResult.error && version === selectionVersion && !syncingProducts.value) {
      cashDayProductIds.value = (selectionResult.data || []).map(row => row.product_id)
      savedCashDayProductIds.value = [...cashDayProductIds.value]
      selectionAvailable.value = true
    }
    if (selectionResult.error) {
      selectionAvailable.value = false
      feedback.value = 'Não foi possível carregar os produtos do dia.'
    }
  } else if (version === selectionVersion && !syncingProducts.value) {
    cashDayProductIds.value = []
    savedCashDayProductIds.value = []
    selectionAvailable.value = false
  }
  if (productsResult.error || ordersResult.error || cashDayResult.error) feedback.value = 'Não foi possível carregar a operação do dia.'
  loading.value = false
}

async function prepareCashDay() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  const { error } = await $supabase.rpc('create_store_cash_day')
  saving.value = false
  feedback.value = error ? 'Não foi possível preparar o caixa de hoje.' : 'Dia preparado. Selecione os produtos antes de iniciar as vendas.'
  if (!error) {
    await loadOperation()
    preparingCashOpen.value = cashDay.value?.status === 'preparing'
  }
}

async function syncCashDayProducts() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value || cashDay.value.status !== 'preparing' || syncingProducts.value) return
  const dayId = cashDay.value.id
  syncingProducts.value = true
  try {
    while (true) {
      const { add, remove } = cashSelectionChanges(cashDayProductIds.value, savedCashDayProductIds.value)
      if (!add.length && !remove.length) break
      if (add.length) {
        const { data, error } = await $supabase.from('store_cash_day_products').insert(add.map(productId => ({ cash_day_id: dayId, product_id: productId }))).select('product_id')
        if (error || data.length !== add.length) throw error || new Error('Seleção incompleta')
        savedCashDayProductIds.value = [...savedCashDayProductIds.value, ...add]
      }
      if (remove.length) {
        const { data, error } = await $supabase.from('store_cash_day_products').delete().eq('cash_day_id', dayId).in('product_id', remove).select('product_id')
        if (error || data.length !== remove.length) throw error || new Error('Seleção incompleta')
        savedCashDayProductIds.value = savedCashDayProductIds.value.filter(id => !remove.includes(id))
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar produtos do caixa:', error)
    cashDayProductIds.value = [...savedCashDayProductIds.value]
    selectionAvailable.value = false
    feedback.value = 'Não foi possível atualizar os produtos. Atualize a página e confira a seleção.'
  } finally {
    syncingProducts.value = false
  }
}

function selectCashDayProducts(ids: string[]) {
  if (!cashDay.value || cashDay.value.status !== 'preparing' || !selectionAvailable.value) return
  selectionVersion++
  cashDayProductIds.value = ids
  void syncCashDayProducts()
}

function toggleCashDayProduct(productId: string) {
  selectCashDayProducts(cashDayProductIds.value.includes(productId)
    ? cashDayProductIds.value.filter(id => id !== productId)
    : [...cashDayProductIds.value, productId])
}

function toggleAllCashDayProducts() {
  selectCashDayProducts(allProductsSelected.value ? [] : [...new Set([...cashDayProductIds.value, ...availableProducts.value.map(product => product.id)])])
}

async function addOpenCashDayProduct(productId: string) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value || cashDay.value.status !== 'open' || saving.value) return
  saving.value = true
  const { error } = await $supabase.from('store_cash_day_products').insert({ cash_day_id: cashDay.value.id, product_id: productId })
  if (error) feedback.value = 'Não foi possível adicionar o produto ao caixa.'
  else await loadOperation(true)
  saving.value = false
}

async function startCashDay() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value || !canStartCashDay.value) return
  const autoCloseTimeValue = closingMode.value === 'automatic' ? autoCloseTime.value : null
  saving.value = true
  const { error } = await $supabase.rpc('start_store_cash_day', { p_day_id: cashDay.value.id, p_auto_close_time: autoCloseTimeValue })
  saving.value = false
  if (error) console.error('Erro ao iniciar vendas:', error)
  feedback.value = error ? 'Não foi possível iniciar as vendas. Confira a seleção e tente novamente.' : 'Caixa aberto. Os produtos selecionados estão disponíveis na loja.'
  if (!error) {
    preparingCashOpen.value = false
    await loadOperation()
  }
}

async function closeCashDay() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value) return
  saving.value = true
  const { error } = await $supabase.rpc('close_store_cash_day', { p_day_id: cashDay.value.id })
  saving.value = false
  if (error) {
    console.error('Erro ao encerrar o caixa:', error)
    closeError.value = 'Não foi possível encerrar o caixa. Confira os pedidos pendentes e tente novamente.'
  } else await navigateTo(`/operacao/relatorios?dia=${cashDay.value.id}`)
}

async function changeOrderStatus(order: StoreOrder, status: 'ready_for_pickup' | 'fulfilled' | 'cancelled') {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  const update = status === 'ready_for_pickup' && cashFlowAvailable.value
    ? { status, payment_method: paymentMethods[order.id] || null }
    : { status }
  const { data, error } = await $supabase.from('store_orders').update(update).eq('id', order.id).eq('status', order.status).select('id').maybeSingle()
  saving.value = false
  feedback.value = error || !data
    ? 'O pedido não foi atualizado. Ele pode ter sido atendido por outra pessoa; atualize a lista antes de tentar novamente.'
    : status === 'ready_for_pickup'
      ? `Pedido ${displayOrderNumber(order)} confirmado para retirada.`
      : status === 'fulfilled'
        ? `Pedido ${displayOrderNumber(order)} entregue e baixado do estoque.`
        : `Pedido ${displayOrderNumber(order)} cancelado e estoque liberado.`
  cancellingOrderId.value = null
  fulfillingOrderId.value = null
  if (!error && data) await loadOperation()
}

function counterOrderCreated() {
  feedback.value = 'Pedido de balcão criado e incluído na fila de atendimento.'
  void loadOperation(true)
}

onMounted(() => {
  void loadOperation()
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !saving.value && !loading.value) void loadOperation(true)
  }, 8000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div class="pb-16">
    <BrandLoadingStatus
      v-if="saving"
      label="Atualizando operação…"
    />
    <PageIntro
      :title="operationTitle"
      :description="operationDescription"
      icon="i-lucide-package-check"
    />
    <UAlert
      v-if="feedback"
      class="mt-5"
      color="neutral"
      variant="subtle"
      :description="feedback"
    />

    <UButton
      v-if="canManageInventory && !creatingOrder && !loading"
      icon="i-lucide-plus"
      label="Novo pedido"
      class="hide-while-typing fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 min-h-14 rounded-full px-5 shadow-xl md:bottom-6 md:right-8"
      @click="creatingOrder = true"
    />

    <UModal
      v-model:open="creatingOrder"
      title="Novo pedido de balcão"
      description="Selecione os produtos do caixa aberto."
      :dismissible="!counterOrderBusy"
      :close="!counterOrderBusy"
      :ui="{ content: 'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg', header: 'pr-14 pt-[max(1rem,env(safe-area-inset-top))]', close: 'top-[max(1rem,env(safe-area-inset-top))]', body: 'overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]' }"
    >
      <template #body>
        <StoreCounterOrderForm
          v-if="creatingOrder && auth.profile"
          :products="counterProducts"
          :open="cashDay?.status === 'open' && (!cashDay.auto_close_at || new Date(cashDay.auto_close_at).getTime() > Date.now())"
          :operator-id="auth.profile.id"
          @created="counterOrderCreated"
          @refresh="loadOperation(true)"
          @busy="counterOrderBusy = $event"
          @close="creatingOrder = false"
        />
      </template>
    </UModal>

    <UModal
      v-if="editingOrder?.cash_day_id"
      :open="true"
      :title="`Editar pedido ${displayOrderNumber(editingOrder)}`"
      description="Altere os produtos e quantidades do pedido."
      :dismissible="!editingOrderBusy"
      :close="!editingOrderBusy"
      :ui="{ content: 'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-2rem)] sm:max-w-4xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg', header: 'pr-14 pt-[max(1rem,env(safe-area-inset-top))]', close: 'top-[max(1rem,env(safe-area-inset-top))]', body: 'overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]' }"
      @update:open="!$event && (editingOrder = null)"
    >
      <template #body>
        <StoreOrderEditForm
          :order-id="editingOrder.id"
          :cash-day-id="editingOrder.cash_day_id"
          :updated-at="editingOrder.updated_at"
          :items="editingOrder.store_order_items"
          :products="products"
          :paid="editingOrder.status === 'ready_for_pickup'"
          @saved="feedback = 'Pedido atualizado.'; loadOperation(true)"
          @busy="editingOrderBusy = $event"
          @close="editingOrder = null"
        />
      </template>
    </UModal>

    <USkeleton
      v-if="loading && canManageInventory"
      class="mt-4 h-40 rounded-2xl"
      aria-label="Carregando caixa"
    />
    <section
      v-else-if="canManageInventory && cashFlowAvailable"
      class="mt-4 rounded-2xl border border-default bg-elevated/30 p-4 sm:mt-6 sm:p-5"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary sm:text-sm sm:tracking-[0.18em]">
            Caixa do dia
          </p>
          <h2 class="mt-1 text-lg font-bold sm:text-2xl">
            {{ cashDay?.status === 'open' ? 'Vendas em andamento' : cashDay?.status === 'preparing' ? 'Prepare as vendas' : 'Inicie um novo dia' }}
          </h2>
          <p class="mt-1 text-sm text-muted">
            Selecione os produtos, abra o caixa e encerre após o atendimento.
          </p>
        </div>
        <UBadge
          :color="cashDay?.status === 'open' ? 'success' : cashDay?.status === 'preparing' ? 'warning' : 'neutral'"
          variant="subtle"
          :label="cashDay?.status === 'open' ? 'Aberto' : cashDay?.status === 'preparing' ? 'Em preparação' : 'Fechado'"
        />
      </div>
      <div
        v-if="!cashDay || (!isTodayCashDay && cashDay.status !== 'open')"
        class="mt-3 flex justify-end sm:mt-5"
      >
        <UButton
          label="Preparar caixa"
          icon="i-lucide-calendar-plus"
          size="sm"
          :loading="saving"
          @click="prepareCashDay"
        />
      </div>
      <div
        v-else-if="cashDay.status === 'preparing'"
        class="mt-3 flex justify-end sm:mt-5"
      >
        <UButton
          label="Continuar preparação"
          icon="i-lucide-settings-2"
          size="sm"
          @click="preparingCashOpen = true"
        />
      </div>
      <div
        v-else-if="cashDay.status === 'open'"
        class="mt-3 flex flex-wrap items-center justify-between gap-3 sm:mt-5"
      >
        <p class="text-sm text-muted">
          {{ cashDayProductIds.length }} produto(s) à venda. {{ cashDay.auto_close_at ? `Encerramento automático às ${new Date(cashDay.auto_close_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}.` : 'Encerramento manual após o culto.' }}
        </p>
        <UButton
          v-if="!cashDay.auto_close_at"
          label="Encerrar caixa"
          icon="i-lucide-square"
          color="neutral"
          variant="outline"
          @click="closeError = ''; confirmingClose = true"
        />
      </div>
      <div
        v-if="cashDay?.status === 'open'"
        class="mt-5 border-t border-default pt-4"
      >
        <h3 class="font-semibold">
          Adicionar produtos ao caixa
        </h3>
        <p class="mt-1 text-sm text-muted">
          Produtos adicionados ficam disponíveis para novos pedidos.
        </p>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <UButton
            v-for="product in activeProducts.filter(item => !cashDayProductIds.includes(item.id))"
            :key="product.id"
            color="neutral"
            variant="outline"
            icon="i-lucide-circle-plus"
            class="min-h-12 justify-start"
            :disabled="saving || product.stock_available <= 0"
            @click="addOpenCashDayProduct(product.id)"
          >
            <span class="min-w-0 text-left"><strong class="block truncate">{{ product.name }}</strong><small class="block">{{ product.stock_available }} disponíveis</small></span>
          </UButton>
        </div>
        <p
          v-if="activeProducts.every(item => cashDayProductIds.includes(item.id))"
          class="mt-3 text-sm text-muted"
        >
          Todos os produtos ativos já foram adicionados.
        </p>
      </div>
      <UModal
        v-if="cashDay?.status === 'preparing'"
        v-model:open="preparingCashOpen"
        title="Preparar caixa do dia"
        description="Escolha os produtos e a forma de encerramento antes de iniciar as vendas."
        :dismissible="!saving && !syncingProducts"
        :close="!saving && !syncingProducts"
        :ui="{ content: 'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none', header: 'pr-14 pt-[max(1rem,env(safe-area-inset-top))]', close: 'top-[max(1rem,env(safe-area-inset-top))]', body: 'overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]' }"
      >
        <template #body>
          <div class="mx-auto max-w-3xl space-y-5">
            <UAlert
              v-if="feedback"
              color="neutral"
              variant="subtle"
              :description="feedback"
            />
            <UAlert
              color="info"
              variant="subtle"
              title="Reposição com o caixa aberto"
              description="Você pode repor no estoque os produtos selecionados aqui enquanto o caixa estiver aberto. Eles continuarão disponíveis para venda."
            />
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="font-semibold">
                  Produtos para venda
                </p>
                <p
                  class="text-sm text-muted"
                  aria-live="polite"
                >
                  {{ cashDayProductIds.length }} selecionado(s){{ syncingProducts ? ' · Salvando seleção…' : '' }}
                </p>
              </div>
              <UButton
                :label="allProductsSelected ? 'Desmarcar todos' : 'Selecionar todos'"
                :icon="allProductsSelected ? 'i-lucide-square' : 'i-lucide-square-check'"
                color="neutral"
                variant="outline"
                class="min-h-11"
                :disabled="saving || !selectionAvailable || !availableProducts.length"
                @click="toggleAllCashDayProducts"
              />
            </div>
            <div class="grid max-h-96 grid-cols-2 gap-2 overflow-y-auto lg:grid-cols-3">
              <UButton
                v-for="product in activeProducts"
                :key="product.id"
                color="neutral"
                variant="ghost"
                type="button"
                class="focus-ring flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border p-2 text-left sm:gap-3 sm:p-3"
                :class="cashDayProductIds.includes(product.id) ? 'border-primary bg-primary/10 text-primary' : 'border-default'"
                :disabled="saving || !selectionAvailable || (product.stock_available <= 0 && !cashDayProductIds.includes(product.id))"
                :aria-pressed="cashDayProductIds.includes(product.id)"
                @click="toggleCashDayProduct(product.id)"
              >
                <span class="min-w-0"><strong class="block break-words">{{ product.name }}</strong><small class="block">{{ product.stock_available > 0 ? `${product.stock_available} disponíveis` : 'Sem estoque' }}</small></span>
                <UIcon
                  :name="cashDayProductIds.includes(product.id) ? 'i-lucide-circle-check' : 'i-lucide-circle-plus'"
                  class="size-5 shrink-0"
                />
              </UButton>
            </div>
            <div class="flex flex-wrap items-end gap-3 border-t border-default pt-4">
              <UFormField label="Encerramento">
                <USelect
                  v-model="closingMode"
                  :items="[{ label: 'Manual', value: 'manual' }, { label: 'Automático', value: 'automatic' }]"
                  class="w-44"
                />
              </UFormField>
              <UFormField
                v-if="closingMode === 'automatic'"
                label="Horário de São Paulo"
              >
                <UInput
                  v-model="autoCloseTime"
                  type="time"
                  class="w-36"
                />
              </UFormField>
              <UButton
                label="Iniciar vendas"
                icon="i-lucide-play"
                class="ml-auto min-h-11"
                :loading="saving"
                :disabled="!canStartCashDay"
                @click="startCashDay"
              />
            </div>
          </div>
        </template>
      </UModal>
      <UModal
        v-if="cashDay?.status === 'open'"
        v-model:open="confirmingClose"
        title="Encerrar o caixa agora?"
        description="Novos pedidos serão bloqueados. Resolva os pedidos aguardando pagamento antes de confirmar."
        :dismissible="!saving"
        :close="!saving"
      >
        <template #body>
          <UAlert
            v-if="closeError"
            color="error"
            variant="subtle"
            :description="closeError"
          />
          <div class="flex flex-wrap gap-2">
            <UButton
              label="Confirmar encerramento"
              :loading="saving"
              @click="closeCashDay"
            />
            <UButton
              label="Voltar"
              color="neutral"
              variant="ghost"
              :disabled="saving"
              @click="confirmingClose = false"
            />
          </div>
        </template>
      </UModal>
      <div
        v-if="cashDay?.status === 'closed' && isTodayCashDay"
        class="mt-3 space-y-3 sm:mt-5"
      >
        <UAlert
          v-if="awaitingPaymentCount"
          color="warning"
          variant="subtle"
          :title="`${awaitingPaymentCount} pedido(s) sem pagamento após o encerramento`"
          description="Cancele os pedidos não pagos abaixo para liberar o estoque. O relatório separa esses pedidos das vendas confirmadas."
        />
        <UButton
          :to="`/operacao/relatorios?dia=${cashDay.id}`"
          label="Ver relatório do dia"
          icon="i-lucide-chart-no-axes-combined"
        />
        <UButton
          label="Preparar nova operação"
          icon="i-lucide-calendar-plus"
          :loading="saving"
          @click="prepareCashDay"
        />
      </div>
    </section>

    <section
      id="fila-atendimento"
      class="mt-6 scroll-mt-4 sm:mt-8"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-primary sm:text-sm sm:tracking-[0.18em]">
            Fila de atendimento
          </p><h2 class="mt-1 text-lg font-bold sm:text-2xl">
            Pedidos em andamento
          </h2><p class="mt-1 text-sm text-muted">
            Confirme o pagamento e, depois, finalize a entrega do pedido.
          </p>
        </div><div class="flex gap-2">
          <UBadge
            color="warning"
            variant="subtle"
            :label="`${awaitingPaymentCount} no caixa`"
          /><UBadge
            color="success"
            variant="subtle"
            :label="`${readyForPickupCount} para retirada`"
          />
        </div>
      </div>
      <div
        v-if="loading"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-44 rounded-xl"
        />
      </div>
      <div
        v-else
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <UCard
          v-for="order in visibleOrders"
          :key="order.id"
          class="overflow-hidden"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <div class="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <UIcon
                    name="i-lucide-receipt-text"
                    class="size-4"
                  />
                </div><div>
                  <p class="font-semibold">
                    Pedido {{ displayOrderNumber(order) }}
                  </p><p
                    v-if="order.order_source === 'counter'"
                    class="text-xs text-muted"
                  >
                    Balcão{{ order.buyer_name ? '' : ' · Cliente não informado' }}
                  </p><p
                    v-if="order.buyer_name"
                    class="truncate text-sm text-muted"
                  >
                    {{ order.buyer_name }}
                  </p>
                </div>
              </div><p class="mt-4 text-2xl font-bold">
                {{ formatMoney(order.total_amount) }}
              </p>
            </div><UBadge
              :color="order.status === 'awaiting_payment' ? 'warning' : 'success'"
              variant="subtle"
              :label="order.status === 'awaiting_payment' ? 'Aguardando caixa' : 'Pronto para retirada'"
            />
          </div>
          <div class="mt-4 rounded-lg bg-elevated/50 p-3 text-sm text-muted">
            <span v-if="order.status === 'awaiting_payment'">Próximo passo: confirmar o pagamento no caixa.</span><span v-else>Próximo passo: entregar o pedido no balcão.</span>
          </div>
          <div class="mt-4 border-t border-default pt-4">
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              Itens do pedido
            </p>
            <ul class="mt-2 space-y-1 text-sm">
              <li
                v-for="(item, index) in order.store_order_items"
                :key="index"
              >
                {{ item.quantity }} × {{ relationName(item.product) || 'Produto' }}
              </li>
            </ul>
            <p
              v-if="order.note"
              class="mt-3 text-sm text-muted"
            >
              Observação: {{ order.note }}
            </p>
          </div>
          <template #footer>
            <UButton
              v-if="canManageInventory && order.cash_day_id"
              block
              class="mb-3"
              color="neutral"
              variant="outline"
              label="Editar pedido"
              icon="i-lucide-pencil"
              :disabled="saving"
              @click="editingOrder = order"
            />
            <USelect
              v-if="cashFlowAvailable && order.status === 'awaiting_payment' && canConfirmOrders"
              v-model="paymentMethods[order.id]"
              :items="paymentOptions"
              placeholder="Forma de pagamento"
              class="mb-3 w-full"
            />
            <UButton
              v-if="order.status === 'awaiting_payment' && canConfirmOrders"
              block
              :loading="saving"
              :disabled="Boolean(cashFlowAvailable) && !paymentMethods[order.id]"
              label="Confirmar no caixa"
              icon="i-lucide-circle-dollar-sign"
              @click="changeOrderStatus(order, 'ready_for_pickup')"
            />
            <UButton
              v-if="order.status === 'awaiting_payment' && canConfirmOrders && cancellingOrderId !== order.id"
              block
              class="mt-2"
              color="error"
              variant="ghost"
              label="Cancelar pedido não pago"
              @click="cancellingOrderId = order.id"
            />
            <div
              v-if="cancellingOrderId === order.id"
              class="mt-2 rounded-lg border border-error/40 p-3"
            >
              <p class="mb-2 text-sm">
                Cancelar o pedido {{ displayOrderNumber(order) }} e liberar o estoque?
              </p>
              <div class="flex gap-2">
                <UButton
                  label="Confirmar cancelamento"
                  color="error"
                  :loading="saving"
                  @click="changeOrderStatus(order, 'cancelled')"
                />
                <UButton
                  label="Voltar"
                  color="neutral"
                  variant="ghost"
                  @click="cancellingOrderId = null"
                />
              </div>
            </div>
            <UButton
              v-if="order.status === 'ready_for_pickup' && canFulfillOrders && fulfillingOrderId !== order.id"
              block
              :loading="saving"
              label="Conferir entrega"
              icon="i-lucide-check"
              @click="fulfillingOrderId = order.id"
            />
            <div
              v-if="fulfillingOrderId === order.id"
              class="rounded-xl border border-primary/30 bg-primary/5 p-3"
            >
              <p class="font-semibold">
                Confirmar entrega {{ displayOrderNumber(order) }}?
              </p>
              <p class="mt-1 text-sm text-muted">
                Confira os itens acima{{ order.buyer_name ? ` e o nome: ${order.buyer_name}` : '' }}. Confirme depois de entregar; isso conclui o pedido e dá baixa no estoque.
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UButton
                  :label="`Confirmar entrega ${displayOrderNumber(order)}`"
                  :loading="saving"
                  icon="i-lucide-check"
                  @click="changeOrderStatus(order, 'fulfilled')"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  label="Voltar"
                  :disabled="saving"
                  @click="fulfillingOrderId = null"
                />
              </div>
            </div>
          </template>
        </UCard>
        <UCard
          v-if="!visibleOrders.length"
          class="lg:col-span-2"
        >
          <div class="flex flex-col items-center py-8 text-center">
            <div class="grid size-12 place-items-center rounded-full bg-muted">
              <UIcon
                name="i-lucide-list-checks"
                class="size-6 text-muted"
              />
            </div><p class="mt-4 font-semibold">
              Fila vazia
            </p><p class="mt-1 text-sm text-muted">
              Os próximos pedidos aparecerão aqui para confirmar o pagamento e finalizar a entrega.
            </p>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
