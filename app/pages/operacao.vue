<script setup lang="ts">
import { canManageChurch, hasRole } from '~/utils/authorization'

definePageMeta({ middleware: ['auth', 'operations'] })
useSeoMeta({ title: 'Caixa e estoque' })

interface Product {
  id: string
  name: string
  sale_price: number
  stock_available: number
  active: boolean
}

interface StoreOrder {
  id: string
  order_number: number
  status: 'awaiting_payment' | 'ready_for_pickup'
  total_amount: number
  created_at: string
  buyer: { full_name: string }[] | null
}

const auth = useAuthStore()
const products = ref<Product[]>([])
const orders = ref<StoreOrder[]>([])
const loading = ref(true)
const saving = ref(false)
const feedback = ref('')
const productForm = reactive({ name: '', description: '', salePrice: 0 })
const batchForm = reactive({ productId: '', quantity: 1, unitCost: null as number | null, expiresOn: '' })

const canManageInventory = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier'))
const canConfirmOrders = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier'))
const canFulfillOrders = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'counter'))
const productItems = computed(() => products.value.filter(product => product.active).map(product => ({ label: `${product.name} (${product.stock_available})`, value: product.id })))

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function loadOperation() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  loading.value = true
  const [productsResult, ordersResult] = await Promise.all([
    $supabase.from('store_products').select('id, name, sale_price, stock_available, active').order('name'),
    $supabase.from('store_orders').select('id, order_number, status, total_amount, created_at, buyer:profiles!store_orders_buyer_id_fkey(full_name)').in('status', ['awaiting_payment', 'ready_for_pickup']).order('created_at')
  ])
  products.value = (productsResult.data || []) as Product[]
  orders.value = (ordersResult.data || []) as StoreOrder[]
  feedback.value = productsResult.error || ordersResult.error ? 'Não foi possível carregar a operação.' : ''
  loading.value = false
}

async function createProduct() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !productForm.name.trim() || productForm.salePrice < 0) return
  saving.value = true
  const { error } = await $supabase.from('store_products').insert({
    name: productForm.name.trim(), description: productForm.description.trim() || null,
    sale_price: productForm.salePrice, created_by: auth.profile.id
  })
  saving.value = false
  if (error) feedback.value = 'Não foi possível cadastrar o produto.'
  else {
    productForm.name = ''
    productForm.description = ''
    productForm.salePrice = 0
    feedback.value = 'Produto cadastrado. Agora adicione uma entrada de estoque.'
    await loadOperation()
  }
}

async function addBatch() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !batchForm.productId || batchForm.quantity <= 0) return
  saving.value = true
  const { error } = await $supabase.from('inventory_batches').insert({
    product_id: batchForm.productId, quantity_received: batchForm.quantity, quantity_on_hand: batchForm.quantity,
    unit_cost: batchForm.unitCost, expires_on: batchForm.expiresOn || null, received_by: auth.profile.id
  })
  saving.value = false
  if (error) feedback.value = 'Não foi possível registrar a entrada de estoque.'
  else {
    batchForm.productId = ''
    batchForm.quantity = 1
    batchForm.unitCost = null
    batchForm.expiresOn = ''
    feedback.value = 'Entrada registrada e saldo disponível atualizado.'
    await loadOperation()
  }
}

async function changeOrderStatus(order: StoreOrder, status: 'ready_for_pickup' | 'fulfilled') {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  saving.value = true
  const { error } = await $supabase.from('store_orders').update({ status }).eq('id', order.id)
  saving.value = false
  feedback.value = error
    ? 'Não foi possível atualizar o pedido. Confirme seu papel e o status atual.'
    : status === 'ready_for_pickup' ? `Pedido #${order.order_number} confirmado para retirada.` : `Pedido #${order.order_number} entregue e baixado do estoque.`
  if (!error) await loadOperation()
}

onMounted(loadOperation)
</script>

<template>
  <div>
    <PageIntro
      title="Caixa e estoque"
      description="O caixa cadastra produtos e confirma pedidos; o balcão entrega e dá baixa definitiva nos lotes reservados."
      icon="i-lucide-package-check"
    />
    <UAlert
      v-if="feedback"
      class="mt-5"
      color="neutral"
      variant="subtle"
      :description="feedback"
    />
    <div class="mt-6 grid gap-6 xl:grid-cols-2">
      <UCard v-if="canManageInventory">
        <template #header>
          <h2 class="font-semibold">
            Novo produto
          </h2>
        </template>
        <div class="space-y-4">
          <UFormField label="Nome">
            <UInput v-model="productForm.name" />
          </UFormField><UFormField label="Descrição">
            <UTextarea
              v-model="productForm.description"
              :rows="2"
            />
          </UFormField><UFormField label="Preço de venda">
            <UInput
              v-model.number="productForm.salePrice"
              type="number"
              min="0"
              step="0.01"
            />
          </UFormField>
        </div>
        <template #footer>
          <UButton
            :loading="saving"
            :disabled="!productForm.name.trim()"
            label="Cadastrar produto"
            @click="createProduct"
          />
        </template>
      </UCard>
      <UCard v-if="canManageInventory">
        <template #header>
          <h2 class="font-semibold">
            Entrada de estoque
          </h2>
        </template>
        <div class="space-y-4">
          <UFormField label="Produto">
            <USelect
              v-model="batchForm.productId"
              :items="productItems"
              class="w-full"
            />
          </UFormField><UFormField label="Quantidade">
            <UInput
              v-model.number="batchForm.quantity"
              type="number"
              min="0.001"
              step="0.001"
            />
          </UFormField><UFormField label="Custo unitário opcional">
            <UInput
              v-model.number="batchForm.unitCost"
              type="number"
              min="0"
              step="0.01"
            />
          </UFormField><UFormField label="Validade opcional">
            <AppDatePicker v-model="batchForm.expiresOn" />
          </UFormField>
        </div>
        <template #footer>
          <UButton
            :loading="saving"
            :disabled="!batchForm.productId || batchForm.quantity <= 0"
            label="Registrar entrada"
            icon="i-lucide-package-plus"
            @click="addBatch"
          />
        </template>
      </UCard>
    </div>

    <section class="mt-8">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Saldo atual
          </p><h2 class="mt-1 text-2xl font-bold">
            Produtos
          </h2>
        </div><UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-refresh-cw"
          :loading="loading"
          label="Atualizar"
          @click="loadOperation"
        />
      </div><div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <UCard
          v-for="product in products"
          :key="product.id"
        >
          <p class="font-semibold">
            {{ product.name }}
          </p><p class="mt-2 text-2xl font-bold">
            {{ product.stock_available }}
          </p><p class="text-sm text-muted">
            disponível(is) · {{ formatMoney(product.sale_price) }}
          </p>
        </UCard><UCard v-if="!loading && !products.length">
          <p class="text-sm text-muted">
            Nenhum produto cadastrado.
          </p>
        </UCard>
      </div>
    </section>

    <section class="mt-8">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
        Fila de atendimento
      </p><h2 class="mt-1 text-2xl font-bold">
        Pedidos
      </h2><div class="mt-5 grid gap-4 lg:grid-cols-2">
        <UCard
          v-for="order in orders"
          :key="order.id"
        >
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-semibold">
                Pedido #{{ order.order_number }}
              </p><p class="text-sm text-muted">
                {{ order.buyer?.[0]?.full_name || 'Membro' }} · {{ formatMoney(order.total_amount) }}
              </p>
            </div><UBadge
              variant="subtle"
              :label="order.status === 'awaiting_payment' ? 'Aguardando caixa' : 'Pronto para retirada'"
            />
          </div><template #footer>
            <UButton
              v-if="order.status === 'awaiting_payment' && canConfirmOrders"
              :loading="saving"
              label="Confirmar no caixa"
              icon="i-lucide-circle-dollar-sign"
              @click="changeOrderStatus(order, 'ready_for_pickup')"
            /><UButton
              v-if="order.status === 'ready_for_pickup' && canFulfillOrders"
              :loading="saving"
              label="Entregar e dar baixa"
              icon="i-lucide-check"
              @click="changeOrderStatus(order, 'fulfilled')"
            />
          </template>
        </UCard><UCard v-if="!loading && !orders.length">
          <p class="text-sm text-muted">
            Não há pedidos aguardando atendimento.
          </p>
        </UCard>
      </div>
    </section>
  </div>
</template>
