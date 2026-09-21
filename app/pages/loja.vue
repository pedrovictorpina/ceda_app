<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Loja' })

interface Product {
  id: string
  name: string
  description: string | null
  sale_price: number
  stock_available: number
}

interface Order {
  id: string
  order_number: number
  status: 'awaiting_payment' | 'ready_for_pickup' | 'fulfilled' | 'cancelled'
  total_amount: number
  created_at: string
}

const auth = useAuthStore()
const products = ref<Product[]>([])
const orders = ref<Order[]>([])
const quantities = reactive<Record<string, number>>({})
const cart = ref<Array<Product & { quantity: number }>>([])
const note = ref('')
const loading = ref(true)
const placingOrder = ref(false)
const feedback = ref('')

const cartTotal = computed(() => cart.value.reduce((total, item) => total + item.sale_price * item.quantity, 0))
const cartItemsCount = computed(() => cart.value.reduce((total, item) => total + item.quantity, 0))
const statusLabels: Record<Order['status'], string> = {
  awaiting_payment: 'Aguardando caixa',
  ready_for_pickup: 'Pronto para retirada',
  fulfilled: 'Entregue',
  cancelled: 'Cancelado'
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function loadStore() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return
  loading.value = true
  const [productsResult, ordersResult] = await Promise.all([
    $supabase.from('store_products').select('id, name, description, sale_price, stock_available').eq('active', true).gt('stock_available', 0).order('name'),
    $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at').eq('buyer_id', auth.profile.id).order('created_at', { ascending: false }).limit(20)
  ])
  products.value = (productsResult.data || []) as Product[]
  orders.value = (ordersResult.data || []) as Order[]
  feedback.value = productsResult.error || ordersResult.error ? 'Não foi possível atualizar a loja. Tente novamente.' : ''
  loading.value = false
}

function addToCart(product: Product) {
  const quantity = Math.max(1, Math.floor(quantities[product.id] || 1))
  const existing = cart.value.find(item => item.id === product.id)
  const nextQuantity = (existing?.quantity || 0) + quantity
  if (nextQuantity > product.stock_available) {
    feedback.value = `Há somente ${product.stock_available} unidade(s) disponível(is) de ${product.name}.`
    return
  }
  if (existing) existing.quantity = nextQuantity
  else cart.value.push({ ...product, quantity })
  quantities[product.id] = 1
  feedback.value = ''
}

function removeFromCart(productId: string) {
  cart.value = cart.value.filter(item => item.id !== productId)
}

function updateCartQuantity(productId: string, nextQuantity: number) {
  const item = cart.value.find(entry => entry.id === productId)
  if (!item) return
  if (nextQuantity <= 0) {
    removeFromCart(productId)
    return
  }
  item.quantity = Math.min(item.stock_available, Math.floor(nextQuantity))
}

async function placeOrder() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !cart.value.length) return
  placingOrder.value = true
  feedback.value = ''
  const { data: order, error: orderError } = await $supabase
    .from('store_orders')
    .insert({ buyer_id: auth.profile.id, note: note.value.trim() || null })
    .select('id, order_number')
    .single()
  if (orderError || !order) {
    feedback.value = 'Não foi possível criar seu pedido.'
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
      feedback.value = error.message.includes('Estoque insuficiente')
        ? 'Um item ficou sem estoque enquanto você finalizava. Atualizamos a loja para você ajustar o carrinho.'
        : 'Não foi possível reservar todos os itens do pedido.'
      placingOrder.value = false
      await loadStore()
      return
    }
  }

  cart.value = []
  note.value = ''
  feedback.value = `Pedido #${order.order_number} recebido. Aguarde a confirmação do caixa.`
  placingOrder.value = false
  await loadStore()
}

onMounted(loadStore)
</script>

<template>
  <div>
    <PageIntro
      title="Loja"
      description="Escolha itens disponíveis. Seu pedido é reservado em tempo real antes de seguir para o caixa."
      icon="i-lucide-shopping-bag"
    />
    <UAlert
      v-if="feedback"
      class="mt-5"
      color="neutral"
      variant="subtle"
      :description="feedback"
    />
    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_23rem]">
      <section>
        <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Catálogo
            </p>
            <h2 class="mt-1 text-2xl font-bold tracking-tight">
              Escolha o que precisa
            </h2>
            <p class="mt-1 text-sm text-muted">
              A disponibilidade é atualizada quando o pedido é enviado.
            </p>
          </div>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            label="Atualizar"
            @click="loadStore"
          />
        </div>
        <div class="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          <template v-if="loading">
            <USkeleton
              v-for="index in 6"
              :key="index"
              class="h-56 rounded-xl"
            />
          </template>
          <UCard
            v-for="product in products"
            :key="product.id"
            class="group overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-shopping-bag"
                  class="size-5"
                />
              </div>
              <UBadge
                color="success"
                variant="subtle"
                :label="`${product.stock_available} em estoque`"
              />
            </div>
            <p class="mt-5 text-lg font-semibold leading-tight">
              {{ product.name }}
            </p>
            <p class="mt-2 min-h-10 text-sm leading-5 text-muted">
              {{ product.description || 'Item disponível para pedido.' }}
            </p>
            <div class="mt-5 flex items-end justify-between gap-3">
              <div>
                <p class="text-xs font-medium uppercase tracking-wide text-muted">
                  Preço
                </p>
                <p class="mt-1 text-xl font-bold text-primary">
                  {{ formatMoney(product.sale_price) }}
                </p>
              </div>
              <p class="text-right text-xs text-muted">
                Reserva<br>em tempo real
              </p>
            </div>
            <template #footer>
              <div class="flex items-center gap-2">
                <UInput
                  v-model.number="quantities[product.id]"
                  class="w-20"
                  type="number"
                  min="1"
                  :max="product.stock_available"
                  placeholder="1"
                  aria-label="Quantidade"
                />
                <UButton
                  class="flex-1"
                  label="Adicionar"
                  icon="i-lucide-plus"
                  @click="addToCart(product)"
                />
              </div>
            </template>
          </UCard>
          <UCard
            v-if="!loading && !products.length"
            class="sm:col-span-2 2xl:col-span-3"
          >
            <div class="flex flex-col items-center py-8 text-center">
              <div class="grid size-12 place-items-center rounded-full bg-muted">
                <UIcon
                  name="i-lucide-package-x"
                  class="size-6 text-muted"
                />
              </div>
              <p class="mt-4 font-semibold">
                Nenhum item disponível agora
              </p>
              <p class="mt-1 max-w-sm text-sm text-muted">
                Volte em alguns instantes: o catálogo aparece assim que o caixa registra uma entrada de estoque.
              </p>
            </div>
          </UCard>
        </div>
      </section>
      <aside class="space-y-5 xl:sticky xl:top-5 xl:self-start">
        <UCard class="overflow-hidden">
          <template #header>
            <div class="flex items-center justify-between gap-3">
              <div>
                <h2 class="font-semibold">
                  Carrinho
                </h2><p class="mt-0.5 text-sm text-muted">
                  Revise antes de enviar
                </p>
              </div>
              <UBadge
                v-if="cartItemsCount"
                color="primary"
                :label="`${cartItemsCount} ${cartItemsCount === 1 ? 'item' : 'itens'}`"
              />
            </div>
          </template>
          <div
            v-if="cart.length"
            class="space-y-3"
          >
            <div
              v-for="item in cart"
              :key="item.id"
              class="rounded-xl border border-default bg-elevated/40 p-3"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-medium">
                    {{ item.name }}
                  </p><p class="mt-1 text-sm text-muted">
                    {{ formatMoney(item.sale_price) }} cada
                  </p>
                </div>
                <p class="shrink-0 font-semibold">
                  {{ formatMoney(item.sale_price * item.quantity) }}
                </p>
              </div>
              <div class="mt-3 flex items-center justify-between">
                <div class="flex items-center rounded-lg border border-default">
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-minus"
                    :aria-label="`Diminuir ${item.name}`"
                    @click="updateCartQuantity(item.id, item.quantity - 1)"
                  />
                  <span class="w-8 text-center text-sm font-semibold">{{ item.quantity }}</span>
                  <UButton
                    color="neutral"
                    variant="ghost"
                    size="xs"
                    icon="i-lucide-plus"
                    :disabled="item.quantity >= item.stock_available"
                    :aria-label="`Aumentar ${item.name}`"
                    @click="updateCartQuantity(item.id, item.quantity + 1)"
                  />
                </div>
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-trash-2"
                  label="Remover"
                  @click="removeFromCart(item.id)"
                />
              </div>
            </div>
          </div>
          <p
            v-else
            class="rounded-xl border border-dashed border-default bg-elevated/40 p-4 text-sm leading-5 text-muted"
          >
            Adicione itens para criar um pedido.
          </p>
          <UFormField
            class="mt-4"
            label="Observação opcional"
          >
            <UTextarea
              v-model="note"
              :rows="2"
              placeholder="Ex.: retirar após o culto"
            />
          </UFormField>
          <template #footer>
            <div class="mb-4 flex items-end justify-between">
              <span class="text-sm text-muted">Total do pedido</span><p class="text-xl font-bold text-primary">
                {{ formatMoney(cartTotal) }}
              </p>
            </div>
            <UButton
              block
              :disabled="!cart.length"
              :loading="placingOrder"
              label="Enviar pedido"
              icon="i-lucide-shopping-cart"
              @click="placeOrder"
            />
            <p class="mt-3 text-center text-xs leading-4 text-muted">
              O pedido reserva os itens. O pagamento e a retirada são confirmados pela equipe.
            </p>
          </template>
        </UCard>
        <UCard>
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon
                name="i-lucide-receipt-text"
                class="size-4 text-primary"
              /><h2 class="font-semibold">
                Meus pedidos
              </h2>
            </div>
          </template>
          <div
            v-if="orders.length"
            class="space-y-3"
          >
            <div
              v-for="order in orders"
              :key="order.id"
              class="rounded-xl border border-default p-3"
            >
              <div class="flex justify-between gap-2">
                <p class="font-medium">
                  Pedido #{{ order.order_number }}
                </p><UBadge
                  variant="subtle"
                  :label="statusLabels[order.status]"
                />
              </div><div class="mt-2 flex items-center justify-between text-sm">
                <p class="text-muted">
                  {{ new Date(order.created_at).toLocaleDateString('pt-BR') }}
                </p><p class="font-semibold">
                  {{ formatMoney(order.total_amount) }}
                </p>
              </div>
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
          >
            Você ainda não fez pedidos.
          </p>
        </UCard>
      </aside>
    </div>
  </div>
</template>
