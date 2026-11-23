<script setup lang="ts">
import { cartQuantityOf, cartTotal, formatBRL, setCartQuantity, type CartItem, type StoreProduct } from '~/utils/storeCart'

interface OrderItem {
  product_id: string
  quantity: number
  unit_price: number
}

interface Product extends StoreProduct {
  active: boolean
}

const props = defineProps<{ orderId: string, cashDayId: string, updatedAt: string, items: OrderItem[], products: Product[], paid: boolean }>()
const emit = defineEmits<{ saved: [], close: [], busy: [value: boolean] }>()
const cart = ref<CartItem[]>([])
const selectedProductIds = ref<string[]>([])
const search = ref('')
const loading = ref(true)
const busy = ref(false)
const errorMessage = ref('')
watch(busy, value => emit('busy', value), { flush: 'sync' })

const availableProducts = computed(() => props.products.flatMap((product) => {
  const original = props.items.find(item => item.product_id === product.id)
  const quantity = Number(original?.quantity ?? 0)
  if (!selectedProductIds.value.includes(product.id) && !original) return []
  if (!product.active && !cartQuantityOf(cart.value, product.id)) return []
  const stock = product.active ? Number(product.stock_available) + quantity : quantity
  if (stock < 1 && !original) return []
  return [{ ...product, sale_price: Number(original?.unit_price ?? product.sale_price), stock_available: stock }]
}))
const visibleProducts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  return availableProducts.value.filter(product => product.name.toLocaleLowerCase('pt-BR').includes(term))
})

onMounted(async () => {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    errorMessage.value = 'Não foi possível carregar os produtos. Feche e tente novamente.'
    loading.value = false
    return
  }
  const { data, error } = await $supabase.from('store_cash_day_products').select('product_id').eq('cash_day_id', props.cashDayId)
  if (error) errorMessage.value = 'Não foi possível carregar os produtos. Feche e tente novamente.'
  else {
    selectedProductIds.value = data.map(item => item.product_id)
    cart.value = props.items.flatMap((item) => {
      const product = props.products.find(candidate => candidate.id === item.product_id)
      return product ? [{ ...product, quantity: Number(item.quantity), sale_price: Number(item.unit_price) }] : []
    })
    if (cart.value.length !== props.items.length) errorMessage.value = 'Não foi possível carregar todos os itens. Feche e tente novamente.'
  }
  loading.value = false
})

function changeQuantity(product: StoreProduct, quantity: number) {
  const result = setCartQuantity(cart.value, product, quantity)
  if (result.ok) cart.value = result.cart
}

async function save() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || loading.value || busy.value || errorMessage.value || !cart.value.length) return
  busy.value = true
  const { error } = await $supabase.rpc('edit_store_order', {
    p_order_id: props.orderId,
    p_expected_updated_at: props.updatedAt,
    p_items: cart.value.map(item => ({ product_id: item.id, quantity: item.quantity }))
  })
  busy.value = false
  if (error) {
    console.error('Erro ao editar pedido:', error)
    errorMessage.value = 'Não foi possível salvar. Atualize a operação e confira o pedido e o estoque antes de tentar novamente.'
    return
  }
  emit('saved')
  emit('close')
}
</script>

<template>
  <div class="space-y-4">
    <UAlert
      v-if="paid"
      color="warning"
      variant="subtle"
      description="Este pedido já foi pago. A edição altera o total sem registrar cobrança ou devolução."
    />
    <UAlert
      v-if="errorMessage"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />
    <BrandLoader
      v-if="loading"
      label="Carregando produtos…"
    />
    <template v-else>
      <UFormField label="Buscar produto">
        <UInput
          v-model="search"
          icon="i-lucide-search"
          placeholder="Nome do produto"
          class="w-full"
        />
      </UFormField>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StoreProductItem
          v-for="product in visibleProducts"
          :key="product.id"
          :product="product"
          :quantity="cartQuantityOf(cart, product.id)"
          image-url=""
          @change="changeQuantity(product, $event)"
        />
      </div>
      <p
        v-if="!visibleProducts.length"
        class="text-sm text-muted"
      >
        Nenhum produto disponível para esta busca.
      </p>
      <p class="font-semibold">
        Total: {{ formatBRL(cartTotal(cart)) }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          label="Salvar pedido"
          icon="i-lucide-save"
          :loading="busy"
          :disabled="!cart.length || Boolean(errorMessage)"
          @click="save"
        />
        <UButton
          label="Voltar"
          color="neutral"
          variant="ghost"
          :disabled="busy"
          @click="emit('close')"
        />
      </div>
    </template>
  </div>
</template>
