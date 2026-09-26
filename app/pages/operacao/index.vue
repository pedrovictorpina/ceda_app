<script setup lang="ts">
import { canManageChurch, hasRole } from '~/utils/authorization'

definePageMeta({ middleware: ['auth', 'operations'] })
useSeoMeta({ title: 'Caixa e pedidos' })

interface Product {
  id: string
  name: string
  stock_available: number
  active: boolean
}

interface StoreOrder {
  id: string
  order_number: number
  status: 'awaiting_payment' | 'ready_for_pickup'
  total_amount: number
  created_at: string
  note: string | null
  buyer_name: string | null
  store_order_items: Array<{ quantity: number, product: { name: string } | { name: string }[] | null }>
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
const closingMode = ref<'manual' | 'automatic'>('manual')
const autoCloseTime = ref('22:00')
const confirmingClose = ref(false)
const cancellingOrderId = ref<string | null>(null)
const paymentMethods = reactive<Record<string, string>>({})
const loading = ref(true)
const saving = ref(false)
const feedback = ref('')

const canManageInventory = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier'))
const canConfirmOrders = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier'))
const canFulfillOrders = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'counter'))
const activeProducts = computed(() => products.value.filter(product => product.active))
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
const operationTitle = computed(() => canManageInventory.value ? 'Caixa e pedidos' : 'Balcão e entrega')
const operationDescription = computed(() => canManageInventory.value
  ? 'Prepare os produtos do dia e confirme pagamentos. O balcão recebe os pedidos liberados para retirada.'
  : 'Confira os itens de cada pedido liberado, entregue ao membro e confirme a baixa do estoque.')
const paymentOptions = [
  { label: 'Dinheiro', value: 'cash' },
  { label: 'Pix', value: 'pix' },
  { label: 'Cartão de débito', value: 'debit_card' },
  { label: 'Cartão de crédito', value: 'credit_card' }
]
const canStartCashDay = computed(() => cashDayProductIds.value.length > 0
  && (closingMode.value === 'manual' || /^([01]\d|2[0-3]):[0-5]\d$/.test(autoCloseTime.value)))
const todayParts = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).formatToParts(new Date())
const todayPart = (type: string) => todayParts.find(part => part.type === type)?.value || ''
const todayInSaoPaulo = `${todayPart('year')}-${todayPart('month')}-${todayPart('day')}`
const isTodayCashDay = computed(() => cashDay.value?.business_date === todayInSaoPaulo)
let refreshTimer: ReturnType<typeof setInterval> | undefined

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function relationName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name
}

async function loadOperation(silent = false) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  if (!silent) loading.value = true
  if (cashFlowAvailable.value === null) {
    const { error } = await $supabase.rpc('sync_store_cash_day')
    cashFlowAvailable.value = !error
  } else if (cashFlowAvailable.value) await $supabase.rpc('sync_store_cash_day')
  const ordersQuery = cashFlowAvailable.value
    ? $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at, note, buyer_name, store_order_items(quantity, product:store_products(name))')
    : $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at, note, store_order_items(quantity, product:store_products(name))')
  const [productsResult, ordersResult, cashDayResult] = await Promise.all([
    $supabase.from('store_products').select('*').order('name'),
    ordersQuery.in('status', ['awaiting_payment', 'ready_for_pickup']).order('created_at'),
    cashFlowAvailable.value
      ? $supabase.from('store_cash_days').select('id, business_date, status, started_at, auto_close_at, closed_at').order('business_date', { ascending: false }).limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])
  products.value = (productsResult.data || []) as Product[]
  orders.value = ((ordersResult.data || []) as unknown as StoreOrder[]).map(order => ({ ...order, buyer_name: order.buyer_name || null }))
  cashDay.value = cashDayResult.data as CashDay | null
  if (cashDay.value) {
    const selectionResult = await $supabase.from('store_cash_day_products').select('product_id').eq('cash_day_id', cashDay.value.id)
    cashDayProductIds.value = (selectionResult.data || []).map(row => row.product_id)
    if (selectionResult.error) feedback.value = 'Não foi possível carregar os produtos do dia.'
  } else cashDayProductIds.value = []
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
  if (!error) await loadOperation()
}

async function toggleCashDayProduct(productId: string) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value || cashDay.value.status !== 'preparing') return
  saving.value = true
  const selected = cashDayProductIds.value.includes(productId)
  const { error } = selected
    ? await $supabase.from('store_cash_day_products').delete().eq('cash_day_id', cashDay.value.id).eq('product_id', productId)
    : await $supabase.from('store_cash_day_products').insert({ cash_day_id: cashDay.value.id, product_id: productId })
  saving.value = false
  if (error) feedback.value = 'Não foi possível atualizar os produtos do dia.'
  else await loadOperation(true)
}

async function startCashDay() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value) return
  const autoCloseTimeValue = closingMode.value === 'automatic' ? autoCloseTime.value : null
  saving.value = true
  const { error } = await $supabase.rpc('start_store_cash_day', { p_day_id: cashDay.value.id, p_auto_close_time: autoCloseTimeValue })
  saving.value = false
  feedback.value = error ? error.message : 'Caixa aberto. Os produtos selecionados estão disponíveis na loja.'
  if (!error) await loadOperation()
}

async function closeCashDay() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !cashDay.value) return
  saving.value = true
  const { error } = await $supabase.rpc('close_store_cash_day', { p_day_id: cashDay.value.id })
  saving.value = false
  if (error) feedback.value = error.message
  else await navigateTo(`/operacao/relatorios?dia=${cashDay.value.id}`)
}

async function changeOrderStatus(order: StoreOrder, status: 'ready_for_pickup' | 'fulfilled' | 'cancelled') {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  const update = status === 'ready_for_pickup' && cashFlowAvailable.value
    ? { status, payment_method: paymentMethods[order.id] || null }
    : { status }
  const { error } = await $supabase.from('store_orders').update(update).eq('id', order.id)
  saving.value = false
  feedback.value = error
    ? 'Não foi possível atualizar o pedido. Confirme seu papel e o status atual.'
    : status === 'ready_for_pickup'
      ? `Pedido #${order.order_number} confirmado para retirada.`
      : status === 'fulfilled'
        ? `Pedido #${order.order_number} entregue e baixado do estoque.`
        : `Pedido #${order.order_number} cancelado e estoque liberado.`
  cancellingOrderId.value = null
  if (!error) await loadOperation()
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
  <div>
    <BrandLoadingStatus
      v-if="saving"
      label="Atualizando operação…"
    />
    <PageIntro
      :title="operationTitle"
      :description="operationDescription"
      icon="i-lucide-package-check"
    />
    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando operação…"
    />
    <UAlert
      v-if="feedback"
      class="mt-5"
      color="neutral"
      variant="subtle"
      :description="feedback"
    />

    <div
      v-if="canManageInventory"
      class="mt-5 flex flex-wrap gap-2"
    >
      <UButton
        to="/operacao/estoque"
        label="Controle de estoque"
        icon="i-lucide-boxes"
        color="neutral"
        variant="outline"
      />
      <UButton
        to="/operacao/relatorios"
        label="Relatórios"
        icon="i-lucide-chart-no-axes-combined"
        color="neutral"
        variant="outline"
      />
    </div>

    <section
      v-if="canManageInventory && cashFlowAvailable"
      class="mt-6 rounded-2xl border border-default bg-elevated/30 p-5"
    >
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Caixa do dia
          </p>
          <h2 class="mt-1 text-2xl font-bold">
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
        class="mt-5"
      >
        <UButton
          label="Preparar caixa de hoje"
          icon="i-lucide-calendar-plus"
          :loading="saving"
          @click="prepareCashDay"
        />
      </div>
      <div
        v-else-if="cashDay.status === 'preparing'"
        class="mt-5 space-y-5"
      >
        <p class="text-sm text-muted">
          Produtos disponíveis para venda hoje: {{ cashDayProductIds.length }} selecionado(s).
        </p>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <button
            v-for="product in activeProducts"
            :key="product.id"
            type="button"
            class="focus-ring flex items-center justify-between gap-3 rounded-xl border border-default p-3 text-left hover:bg-elevated"
            :disabled="saving || product.stock_available <= 0"
            :aria-pressed="cashDayProductIds.includes(product.id)"
            @click="toggleCashDayProduct(product.id)"
          >
            <span class="min-w-0"><strong class="block truncate">{{ product.name }}</strong><small class="text-muted">{{ product.stock_available }} disponíveis</small></span>
            <UIcon
              :name="cashDayProductIds.includes(product.id) ? 'i-lucide-circle-check' : 'i-lucide-circle-plus'"
              class="size-5 shrink-0 text-primary"
            />
          </button>
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
            :loading="saving"
            :disabled="!canStartCashDay"
            @click="startCashDay"
          />
        </div>
      </div>
      <div
        v-else-if="cashDay.status === 'open'"
        class="mt-5 flex flex-wrap items-center justify-between gap-3"
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
          @click="confirmingClose = true"
        />
      </div>
      <div
        v-if="confirmingClose && cashDay?.status === 'open'"
        class="mt-4 rounded-xl border border-warning/40 bg-warning/10 p-4"
      >
        <p class="font-semibold">
          Encerrar o caixa agora?
        </p>
        <p class="mt-1 text-sm text-muted">
          Novos pedidos serão bloqueados. Resolva os pedidos aguardando pagamento antes de confirmar.
        </p>
        <div class="mt-3 flex gap-2">
          <UButton
            label="Confirmar encerramento"
            :loading="saving"
            @click="closeCashDay"
          />
          <UButton
            label="Voltar"
            color="neutral"
            variant="ghost"
            @click="confirmingClose = false"
          />
        </div>
      </div>
      <div
        v-if="cashDay?.status === 'closed' && isTodayCashDay"
        class="mt-5 space-y-3"
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
      </div>
    </section>

    <section class="mt-8">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Fila de atendimento
          </p><h2 class="mt-1 text-2xl font-bold">
            Pedidos em andamento
          </h2><p class="mt-1 text-sm text-muted">
            O caixa confirma o pagamento; o balcão finaliza a entrega.
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
                    Pedido #{{ order.order_number }}
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
                Cancelar o pedido #{{ order.order_number }} e liberar o estoque?
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
              v-if="order.status === 'ready_for_pickup' && canFulfillOrders"
              block
              :loading="saving"
              label="Entregar e dar baixa"
              icon="i-lucide-check"
              @click="changeOrderStatus(order, 'fulfilled')"
            />
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
              {{ canFulfillOrders && !canConfirmOrders ? 'Os pedidos aparecerão aqui após a confirmação do caixa.' : 'Os próximos pedidos dos membros aparecerão aqui para o caixa.' }}
            </p>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
