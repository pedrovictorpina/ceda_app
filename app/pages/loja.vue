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
    <div class="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
          >
            <p class="text-lg font-semibold">
              {{ product.name }}
            </p>
            <p class="mt-2 min-h-10 text-sm text-muted">
              {{ product.description || 'Sem descrição.' }}
            </p>
            <p class="mt-4 text-xl font-bold text-primary">
              {{ formatMoney(product.sale_price) }}
            </p>
            <p class="mt-1 text-xs text-muted">
              {{ product.stock_available }} disponível(is)
            </p>
            <template #footer>
              <div class="flex gap-2">
                <UInput
                  v-model.number="quantities[product.id]"
                  class="w-20"
                  type="number"
                  min="1"
                  :max="product.stock_available"
                  placeholder="1"
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
            class="sm:col-span-2 xl:col-span-3"
          >
            <p class="text-sm text-muted">
              Não há itens disponíveis no momento.
            </p>
          </UCard>
        </div>
      </section>
      <aside class="space-y-5">
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Carrinho
            </h2>
          </template>
          <div
            v-if="cart.length"
            class="space-y-3"
          >
            <div
              v-for="item in cart"
              :key="item.id"
              class="flex items-start justify-between gap-3 text-sm"
            >
              <div>
                <p class="font-medium">
                  {{ item.name }}
                </p><p class="text-muted">
                  {{ item.quantity }} × {{ formatMoney(item.sale_price) }}
                </p>
              </div>
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-trash-2"
                :aria-label="`Remover ${item.name}`"
                @click="removeFromCart(item.id)"
              />
            </div>
          </div>
          <p
            v-else
            class="text-sm text-muted"
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
            <p class="mb-3 text-lg font-bold">
              Total: {{ formatMoney(cartTotal) }}
            </p>
            <UButton
              block
              :disabled="!cart.length"
              :loading="placingOrder"
              label="Enviar pedido"
              icon="i-lucide-shopping-cart"
              @click="placeOrder"
            />
          </template>
        </UCard>
        <UCard>
          <template #header>
            <h2 class="font-semibold">
              Meus pedidos
            </h2>
          </template>
          <div
            v-if="orders.length"
            class="space-y-3"
          >
            <div
              v-for="order in orders"
              :key="order.id"
              class="rounded-lg border border-default p-3"
            >
              <div class="flex justify-between gap-2">
                <p class="font-medium">
                  Pedido #{{ order.order_number }}
                </p><UBadge
                  variant="subtle"
                  :label="statusLabels[order.status]"
                />
              </div><p class="mt-1 text-sm text-muted">
                {{ formatMoney(order.total_amount) }}
              </p>
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
