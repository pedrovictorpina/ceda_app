<script setup lang="ts">
import { cartQuantityOf, cartTotal, formatBRL, reconcileCart, setCartQuantity, type CartItem, type StoreProduct } from '~/utils/storeCart'
import { randomId } from '~/utils/randomId'

const props = defineProps<{ products: StoreProduct[], open: boolean, operatorId: string }>()
const emit = defineEmits<{ created: [], refresh: [], close: [], busy: [value: boolean] }>()
const cart = ref<CartItem[]>([])
const customerName = ref('')
const search = ref('')
const busy = ref(false)
watch(busy, value => emit('busy', value), { flush: 'sync' })
const errorMessage = ref('')
type Pending = { id: string, name: string, items: { product_id: string, quantity: number }[] }
const pending = ref<Pending | null>(null)
const storageKey = computed(() => `ceda-counter-order-${props.operatorId}`)
const visibleProducts = computed(() => {
  const term = search.value.trim().toLocaleLowerCase('pt-BR')
  return props.products.filter(product => product.name.toLocaleLowerCase('pt-BR').includes(term))
})
watch(() => props.products, (products) => {
  if (!pending.value) cart.value = reconcileCart(cart.value, products)
})
onMounted(() => {
  try {
    pending.value = JSON.parse(sessionStorage.getItem(storageKey.value) || 'null') as Pending | null
  } catch {
    pending.value = null
  }
})
function changeQuantity(product: StoreProduct, quantity: number) {
  const result = setCartQuantity(cart.value, product, quantity)
  if (result.ok) cart.value = result.cart
}
async function submit() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || busy.value || (!pending.value && (!props.open || !cart.value.length))) return
  if (!pending.value) {
    pending.value = { id: randomId(), name: customerName.value.trim(), items: cart.value.map(item => ({ product_id: item.id, quantity: item.quantity })) }
    try {
      sessionStorage.setItem(storageKey.value, JSON.stringify(pending.value))
    } catch {
      pending.value = null
      errorMessage.value = 'Não foi possível guardar a tentativa neste aparelho. Verifique o armazenamento do navegador.'
      return
    }
  }
  busy.value = true
  errorMessage.value = ''
  const { error } = await $supabase.rpc('create_counter_order', { p_order_id: pending.value.id, p_customer_name: pending.value.name || null, p_items: pending.value.items })
  busy.value = false
  if (error) {
    if (error.code && /^[0-9A-Z]{5}$/.test(error.code)) {
      sessionStorage.removeItem(storageKey.value)
      pending.value = null
      errorMessage.value = `Pedido não criado: ${error.message} Atualize a operação e revise os itens.`
      emit('refresh')
    } else errorMessage.value = 'Não foi possível confirmar a resposta. Toque em tentar novamente para consultar a mesma tentativa, sem duplicar o pedido.'
    return
  }
  sessionStorage.removeItem(storageKey.value)
  pending.value = null
  cart.value = []
  customerName.value = ''
  emit('created')
  emit('close')
}
</script>

<template>
  <div>
    <UAlert
      v-if="pending"
      class="mt-4"
      color="warning"
      variant="subtle"
      title="Envio pendente de confirmação"
      description="Tente novamente para recuperar o resultado do mesmo pedido."
    />
    <UAlert
      v-if="errorMessage"
      class="mt-4"
      color="error"
      variant="subtle"
      :description="errorMessage"
    />
    <template v-if="!pending">
      <UAlert
        v-if="!open"
        class="mt-4"
        color="warning"
        variant="subtle"
        description="Abra o caixa para criar pedidos."
      />
      <UFormField
        label="Nome do cliente (opcional)"
        class="mt-4"
      >
        <UInput
          v-model="customerName"
          maxlength="120"
          class="w-full"
          placeholder="Ex.: Maria"
          :disabled="busy"
        />
      </UFormField>
      <UFormField
        label="Buscar produto"
        class="mt-4"
      >
        <UInput
          v-model="search"
          icon="i-lucide-search"
          class="w-full"
          placeholder="Nome do produto"
        />
      </UFormField>
      <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
        class="mt-4 text-sm text-muted"
      >
        Nenhum produto disponível para esta busca.
      </p>
      <p class="mt-4 font-semibold">
        {{ cart.length }} produto(s) · {{ formatBRL(cartTotal(cart)) }}
      </p>
    </template>
    <UButton
      class="mt-4 min-h-11"
      :label="pending ? 'Tentar novamente' : 'Criar pedido'"
      icon="i-lucide-receipt-text"
      :loading="busy"
      :disabled="!pending && (!open || !cart.length)"
      @click="submit"
    />
  </div>
</template>
