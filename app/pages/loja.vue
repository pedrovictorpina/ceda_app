<script setup lang="ts">
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { cartCount as countCart, cartQuantityOf, cartTotal as sumCart, formatBRL, reconcileCart, setCartQuantity, type CartItem, type StoreProduct } from '~/utils/storeCart'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Loja' })

interface Order {
  id: string
  order_number: number
  status: 'awaiting_payment' | 'ready_for_pickup' | 'fulfilled' | 'cancelled'
  total_amount: number
  created_at: string
}

const auth = useAuthStore()
const toast = useToast()
const products = ref<StoreProduct[]>([])
const cashDayOpen = ref(false)
const cashFlowAvailable = ref<boolean | null>(null)
const orders = ref<Order[]>([])
const cart = ref<CartItem[]>([])
const note = ref('')
const search = ref('')
const cartOpen = ref(false)
const loading = ref(true)
const placingOrder = ref(false)
const feedback = ref('')
const orderError = ref('')
let refreshTimer: ReturnType<typeof setInterval> | undefined

const cartTotal = computed(() => sumCart(cart.value))
const cartItemsCount = computed(() => countCart(cart.value))
const activeOrders = computed(() => orders.value.filter(order => order.status === 'awaiting_payment' || order.status === 'ready_for_pickup'))
const visibleProducts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  return term ? products.value.filter(product => product.name.toLocaleLowerCase('pt-BR').includes(term)) : products.value
})
const statusLabels: Record<Order['status'], string> = {
  awaiting_payment: 'Aguardando caixa',
  ready_for_pickup: 'Pronto para retirada',
  fulfilled: 'Entregue',
  cancelled: 'Cancelado'
}
const statusColors = {
  awaiting_payment: 'warning',
  ready_for_pickup: 'success',
  fulfilled: 'neutral',
  cancelled: 'error'
} as const satisfies Record<Order['status'], string>

function productImageUrl(path?: string | null) {
  const { $supabase } = useNuxtApp()
  return path && $supabase ? $supabase.storage.from('store-product-images').getPublicUrl(path).data.publicUrl : ''
}

async function loadStore(silent = false) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return
  if (!silent) loading.value = true
  if (cashFlowAvailable.value === null) {
    const { error } = await $supabase.rpc('sync_store_cash_day')
    cashFlowAvailable.value = !error
  } else if (cashFlowAvailable.value) await $supabase.rpc('sync_store_cash_day')
  const [productsResult, ordersResult, cashDayResult] = await Promise.all([
    $supabase.from('store_products').select('*').eq('active', true).gt('stock_available', 0).order('name'),
    $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at').eq('buyer_id', auth.profile.id).order('created_at', { ascending: false }).limit(20),
    cashFlowAvailable.value
      ? $supabase.from('store_cash_days').select('id').eq('status', 'open').limit(1).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ])
  cashDayOpen.value = !cashFlowAvailable.value || Boolean(cashDayResult.data)
  const selectionResult = cashDayResult.data
    ? await $supabase.from('store_cash_day_products').select('product_id').eq('cash_day_id', cashDayResult.data.id)
    : null
  const selectedIds = new Set((selectionResult?.data || []).map(row => row.product_id))
  products.value = ((productsResult.data || []) as StoreProduct[]).filter(product => !cashFlowAvailable.value || selectedIds.has(product.id))
  orders.value = (ordersResult.data || []) as Order[]
  syncCartWithStock()
  feedback.value = productsResult.error || ordersResult.error || cashDayResult.error || selectionResult?.error
    ? 'Não foi possível atualizar a loja. Verifique sua conexão e toque em Atualizar.'
    : ''
  loading.value = false
}

function syncCartWithStock() {
  if (!cart.value.length) return
  const previousCount = cartItemsCount.value
  cart.value = reconcileCart(cart.value, products.value)
  if (cartItemsCount.value < previousCount) {
    toast.add({ title: 'Pedido ajustado', description: 'Alguns itens esgotaram e foram retirados ou reduzidos no seu pedido.', color: 'warning', icon: 'i-lucide-package-minus' })
  }
}

function tapFeedback() {
  Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined)
}

function changeQuantity(product: StoreProduct, quantity: number) {
  const result = setCartQuantity(cart.value, product, quantity)
  if (!result.ok) {
    toast.add({ title: 'Estoque no limite', description: `Há somente ${product.stock_available} unidade(s) de ${product.name}.`, color: 'warning', icon: 'i-lucide-package' })
    return
  }
  cart.value = result.cart
  orderError.value = ''
  tapFeedback()
}

function clearCart() {
  const previousCart = cart.value
  const previousNote = note.value
  cart.value = []
  note.value = ''
  toast.add({
    title: 'Pedido limpo',
    icon: 'i-lucide-trash-2',
    color: 'neutral',
    actions: [{ label: 'Desfazer', color: 'primary', variant: 'soft', onClick: () => {
      cart.value = reconcileCart(previousCart, products.value)
      note.value = previousNote
    } }]
  })
}

async function placeOrder() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !cart.value.length) return
  placingOrder.value = true
  orderError.value = ''
  const { data: order, error: createError } = await $supabase
    .from('store_orders')
    .insert({ buyer_id: auth.profile.id, note: note.value.trim() || null })
    .select('id, order_number')
    .single()
  if (createError || !order) {
    orderError.value = 'Não foi possível criar seu pedido. Tente enviar novamente.'
    placingOrder.value = false
    return
  }

  for (const item of cart.value) {
    const { error } = await $supabase.from('store_order_items').insert({
      order_id: order.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: 0
    })
    if (error) {
      await $supabase.from('store_orders').update({ status: 'cancelled' }).eq('id', order.id)
      orderError.value = error.message.includes('Estoque insuficiente')
        ? 'Um item esgotou enquanto você finalizava. Atualizamos seu pedido; revise e envie de novo.'
        : 'Não foi possível reservar todos os itens do pedido. Tente enviar novamente.'
      placingOrder.value = false
      await loadStore()
      return
    }
  }

  cart.value = []
  note.value = ''
  cartOpen.value = false
  placingOrder.value = false
  toast.add({ title: `Pedido #${order.order_number} enviado`, description: 'Informe esse número no caixa para pagar e retirar.', color: 'success', icon: 'i-lucide-circle-check', duration: 8000 })
  await loadStore()
}

watch(cartItemsCount, (count) => {
  if (!count) cartOpen.value = false
})

onMounted(() => {
  void loadStore()
  refreshTimer = setInterval(() => {
    if (document.visibilityState === 'visible' && !placingOrder.value && !loading.value) void loadStore(true)
  }, 8000)
})
onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})
</script>

<template>
  <div :class="cartItemsCount ? 'pb-20 xl:pb-0' : ''">
    <BrandLoadingStatus
      v-if="placingOrder"
      label="Enviando pedido…"
    />
    <PageIntro
      title="Loja"
      description="Escolha os itens do caixa de hoje. Eles ficam reservados até o pagamento e a retirada."
      icon="i-lucide-shopping-bag"
    />

    <UAlert
      v-if="feedback"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :description="feedback"
    />

    <section
      v-if="activeOrders.length"
      class="mb-6 space-y-2"
      aria-label="Pedidos em andamento"
    >
      <div
        v-for="order in activeOrders"
        :key="order.id"
        class="flex items-center gap-3 rounded-2xl border p-3"
        :class="order.status === 'ready_for_pickup' ? 'border-success/40 bg-success/10' : 'border-warning/40 bg-warning/10'"
      >
        <div
          class="grid size-11 shrink-0 place-items-center rounded-full"
          :class="order.status === 'ready_for_pickup' ? 'bg-success text-white' : 'bg-warning/20 text-warning'"
        >
          <UIcon
            :name="order.status === 'ready_for_pickup' ? 'i-lucide-package-check' : 'i-lucide-hourglass'"
            class="size-5"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-highlighted">
            Pedido #{{ order.order_number }}
          </p>
          <p class="text-sm text-muted">
            {{ order.status === 'ready_for_pickup' ? 'Pronto. Retire no caixa.' : 'Pague no caixa informando o número.' }}
          </p>
        </div>
        <span class="shrink-0 font-bold tabular-nums">{{ formatBRL(order.total_amount) }}</span>
      </div>
    </section>

    <div class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <section aria-labelledby="catalogo">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h2
            id="catalogo"
            class="text-xl font-bold tracking-tight"
          >
            Produtos de hoje
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            label="Atualizar"
            class="rounded-full"
            @click="loadStore()"
          />
        </div>

        <UInput
          v-if="products.length > 6"
          v-model="search"
          class="mb-4 w-full"
          size="lg"
          icon="i-lucide-search"
          placeholder="Buscar produto"
          aria-label="Buscar produto"
          :ui="{ base: 'rounded-full' }"
        />

        <div class="grid gap-3 sm:grid-cols-2 sm:gap-4 2xl:grid-cols-3">
          <template v-if="loading && !products.length">
            <USkeleton
              v-for="index in 4"
              :key="index"
              class="h-28 rounded-2xl sm:h-72"
            />
          </template>
          <StoreProductItem
            v-for="product in visibleProducts"
            :key="product.id"
            :product="product"
            :quantity="cartQuantityOf(cart, product.id)"
            :image-url="productImageUrl(product.image_path)"
            @change="changeQuantity(product, $event)"
          />
          <p
            v-if="!loading && products.length && !visibleProducts.length"
            class="py-8 text-center text-sm text-muted sm:col-span-2 2xl:col-span-3"
          >
            Nenhum produto com “{{ search }}”.
          </p>
          <div
            v-if="!loading && !products.length"
            class="flex flex-col items-center rounded-2xl border border-dashed border-default px-4 py-10 text-center sm:col-span-2 2xl:col-span-3"
          >
            <div class="grid size-12 place-items-center rounded-full bg-elevated">
              <UIcon
                :name="cashDayOpen ? 'i-lucide-package-x' : 'i-lucide-store'"
                class="size-6 text-muted"
              />
            </div>
            <p class="mt-4 font-semibold">
              {{ cashDayOpen ? 'Nenhum item disponível agora' : 'Caixa fechado' }}
            </p>
            <p class="mt-1 max-w-sm text-sm text-muted">
              {{ cashDayOpen ? 'O caixa ainda não liberou produtos com estoque.' : 'Os produtos aparecem aqui quando o responsável inicia as vendas do dia.' }}
            </p>
          </div>
        </div>
      </section>

      <aside class="space-y-5 xl:sticky xl:top-20 xl:self-start">
        <UCard class="hidden xl:block">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <h2 class="font-semibold">
                Seu pedido
              </h2>
              <UButton
                v-if="cart.length"
                color="neutral"
                variant="ghost"
                size="xs"
                icon="i-lucide-trash-2"
                label="Limpar"
                @click="clearCart"
              />
            </div>
          </template>
          <StoreCartItems
            :cart="cart"
            :image-url="productImageUrl"
            @change="(item, quantity) => changeQuantity(item, quantity)"
          />
          <UFormField
            v-if="cart.length"
            class="mt-4"
            label="Observação (opcional)"
          >
            <UTextarea
              v-model="note"
              class="w-full"
              :rows="2"
              placeholder="Ex.: retirar após o culto"
            />
          </UFormField>
          <template #footer>
            <StoreCartSummary
              :total="cartTotal"
              :count="cartItemsCount"
              :placing="placingOrder"
              :error="orderError"
              @submit="placeOrder"
            />
          </template>
        </UCard>

        <section aria-labelledby="meus-pedidos">
          <h2
            id="meus-pedidos"
            class="mb-3 flex items-center gap-2 text-xl font-bold tracking-tight xl:text-base"
          >
            Meus pedidos
          </h2>
          <ul
            v-if="orders.length"
            class="divide-y divide-default rounded-2xl border border-default bg-default"
          >
            <li
              v-for="order in orders"
              :key="order.id"
              class="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div class="min-w-0">
                <p class="font-medium text-highlighted">
                  Pedido #{{ order.order_number }}
                </p>
                <p class="text-sm text-muted">
                  {{ new Date(order.created_at).toLocaleDateString('pt-BR') }}, {{ formatBRL(order.total_amount) }}
                </p>
              </div>
              <UBadge
                class="shrink-0 rounded-full"
                variant="subtle"
                :color="statusColors[order.status]"
                :label="statusLabels[order.status]"
              />
            </li>
          </ul>
          <p
            v-else
            class="rounded-2xl border border-dashed border-default p-4 text-sm text-muted"
          >
            Seus pedidos aparecem aqui depois do primeiro envio.
          </p>
        </section>
      </aside>
    </div>

    <StoreCartFab
      :count="cartItemsCount"
      :total="cartTotal"
      :open="cartOpen"
      @open="cartOpen = true"
    />

    <UDrawer
      v-model:open="cartOpen"
      title="Seu pedido"
      description="Confira as quantidades antes de enviar."
      :ui="{ content: 'max-h-[88dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
    >
      <template #body>
        <StoreCartItems
          :cart="cart"
          :image-url="productImageUrl"
          @change="(item, quantity) => changeQuantity(item, quantity)"
        />
        <UFormField
          class="mt-5"
          label="Observação (opcional)"
        >
          <UTextarea
            v-model="note"
            class="w-full"
            :rows="2"
            placeholder="Ex.: retirar após o culto"
          />
        </UFormField>
        <div class="mt-4 flex justify-between gap-2">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-plus"
            label="Adicionar mais"
            class="rounded-full"
            @click="cartOpen = false"
          />
          <UButton
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            label="Limpar pedido"
            class="rounded-full"
            @click="clearCart"
          />
        </div>
      </template>
      <template #footer>
        <StoreCartSummary
          :total="cartTotal"
          :count="cartItemsCount"
          :placing="placingOrder"
          :error="orderError"
          @submit="placeOrder"
        />
      </template>
    </UDrawer>
  </div>
</template>
