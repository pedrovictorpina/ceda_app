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
const activeProducts = computed(() => products.value.filter(product => product.active))
const lowStockProducts = computed(() => activeProducts.value.filter(product => product.stock_available > 0 && product.stock_available <= 5))
const awaitingPaymentCount = computed(() => orders.value.filter(order => order.status === 'awaiting_payment').length)
const readyForPickupCount = computed(() => orders.value.filter(order => order.status === 'ready_for_pickup').length)

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

    <section
      v-if="canManageInventory"
      class="mt-6"
    >
      <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Catálogo e entradas
          </p><h2 class="mt-1 text-2xl font-bold tracking-tight">
            Abasteça a loja
          </h2>
        </div>
        <p class="max-w-md text-sm text-muted">
          Cadastre o produto uma vez e registre cada recebimento como um lote para manter o saldo confiável.
        </p>
      </div>
      <div class="grid gap-6 xl:grid-cols-2">
        <UCard class="overflow-hidden">
          <template #header>
            <div class="flex items-start gap-3">
              <div class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-package-plus"
                  class="size-5"
                />
              </div><div>
                <h3 class="font-semibold">
                  Novo produto
                </h3><p class="mt-0.5 text-sm text-muted">
                  Disponível após a primeira entrada.
                </p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField
              label="Nome"
              hint="Como aparecerá para o membro"
            >
              <UInput
                v-model="productForm.name"
                placeholder="Ex.: Café coado"
                icon="i-lucide-tag"
              />
            </UFormField>
            <UFormField label="Descrição">
              <UTextarea
                v-model="productForm.description"
                :rows="2"
                placeholder="Ex.: Preparado na hora"
              />
            </UFormField>
            <UFormField
              label="Preço de venda"
              hint="Valor cobrado ao membro"
            >
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
              block
              :loading="saving"
              :disabled="!productForm.name.trim()"
              label="Cadastrar produto"
              icon="i-lucide-plus"
              @click="createProduct"
            />
          </template>
        </UCard>
        <UCard class="overflow-hidden">
          <template #header>
            <div class="flex items-start gap-3">
              <div class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-boxes"
                  class="size-5"
                />
              </div><div>
                <h3 class="font-semibold">
                  Entrada de estoque
                </h3><p class="mt-0.5 text-sm text-muted">
                  Registre um lote para atualizar o saldo.
                </p>
              </div>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField
              label="Produto"
              hint="Selecione um item já cadastrado"
            >
              <USelect
                v-model="batchForm.productId"
                :items="productItems"
                class="w-full"
              />
            </UFormField>
            <UFormField
              label="Quantidade"
              hint="Aceita unidades fracionadas"
            >
              <UInput
                v-model.number="batchForm.quantity"
                type="number"
                min="0.001"
                step="0.001"
              />
            </UFormField>
            <UFormField label="Custo unitário opcional">
              <UInput
                v-model.number="batchForm.unitCost"
                type="number"
                min="0"
                step="0.01"
              />
            </UFormField>
            <UFormField label="Validade opcional">
              <AppDatePicker v-model="batchForm.expiresOn" />
            </UFormField>
          </div>
          <template #footer>
            <UButton
              block
              :loading="saving"
              :disabled="!batchForm.productId || batchForm.quantity <= 0"
              label="Registrar entrada"
              icon="i-lucide-package-plus"
              @click="addBatch"
            />
          </template>
        </UCard>
      </div>
    </section>

    <section class="mt-8">
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Saldo atual
          </p><h2 class="mt-1 text-2xl font-bold">
            Visão do estoque
          </h2><p class="mt-1 text-sm text-muted">
            O saldo já considera as reservas de pedidos em aberto.
          </p>
        </div><div class="flex flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chart-no-axes-combined"
            label="Ver relatórios"
            to="/operacao/relatorios"
          /><UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            label="Atualizar"
            @click="loadOperation"
          />
        </div>
      </div>
      <div
        v-if="loading"
        class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="index in 3"
          :key="index"
          class="h-36 rounded-xl"
        />
      </div>
      <div
        v-else
        class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <UCard
          v-for="product in activeProducts"
          :key="product.id"
          class="overflow-hidden"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="truncate font-semibold">
                {{ product.name }}
              </p><p class="mt-1 text-sm text-muted">
                {{ formatMoney(product.sale_price) }} por unidade
              </p>
            </div><UBadge
              :color="product.stock_available <= 5 ? 'warning' : 'success'"
              variant="subtle"
              :label="product.stock_available <= 5 ? 'Baixo' : 'Em dia'"
            />
          </div>
          <div class="mt-5 flex items-end justify-between">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted">
                Disponível
              </p><p
                class="mt-1 text-3xl font-bold"
                :class="product.stock_available <= 5 ? 'text-warning' : 'text-primary'"
              >
                {{ product.stock_available }}
              </p>
            </div><UIcon
              name="i-lucide-boxes"
              class="size-8 text-muted/50"
            />
          </div>
        </UCard>
        <UCard
          v-if="!activeProducts.length"
          class="sm:col-span-2 xl:col-span-3"
        >
          <div class="flex flex-col items-center py-7 text-center">
            <div class="grid size-12 place-items-center rounded-full bg-muted">
              <UIcon
                name="i-lucide-package-open"
                class="size-6 text-muted"
              />
            </div><p class="mt-4 font-semibold">
              Nenhum produto cadastrado
            </p><p class="mt-1 text-sm text-muted">
              Cadastre o primeiro item e registre uma entrada para disponibilizá-lo na loja.
            </p>
          </div>
        </UCard>
      </div>
      <UAlert
        v-if="!loading && lowStockProducts.length"
        class="mt-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${lowStockProducts.length} ${lowStockProducts.length === 1 ? 'item precisa' : 'itens precisam'} de reposição`"
        :description="`${lowStockProducts.map(product => product.name).join(', ')} ${lowStockProducts.length === 1 ? 'está' : 'estão'} com até 5 unidades disponíveis.`"
      />
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
          v-for="order in orders"
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
                  </p><p class="truncate text-sm text-muted">
                    {{ order.buyer?.[0]?.full_name || 'Membro' }}
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
          <template #footer>
            <UButton
              v-if="order.status === 'awaiting_payment' && canConfirmOrders"
              block
              :loading="saving"
              label="Confirmar no caixa"
              icon="i-lucide-circle-dollar-sign"
              @click="changeOrderStatus(order, 'ready_for_pickup')"
            /><UButton
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
          v-if="!orders.length"
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
              Os próximos pedidos dos membros aparecerão aqui para o caixa e o balcão.
            </p>
          </div>
        </UCard>
      </div>
    </section>
  </div>
</template>
