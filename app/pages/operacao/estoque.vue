<script setup lang="ts">
import { canManageChurch, hasRole } from '~/utils/authorization'

definePageMeta({ middleware: ['auth', 'operations', 'inventory'] })
useSeoMeta({ title: 'Controle de estoque' })

interface Product {
  id: string
  name: string
  image_path: string | null
  sale_price: number
  stock_available: number
  active: boolean
}

interface InventoryBatch {
  id: string
  product_id: string
  quantity_received: number
  quantity_on_hand: number
  expires_on: string | null
  created_at: string
  product: { name: string } | { name: string }[] | null
}

const auth = useAuthStore()
const products = ref<Product[]>([])
const batches = ref<InventoryBatch[]>([])
const loading = ref(true)
const saving = ref(false)
const feedback = ref('')
const productForm = reactive({ name: '', description: '', salePrice: 0 })
const productPhoto = ref<File | null>(null)
const productPhotoPreview = ref('')
const productPhotoInputKey = ref(0)
const batchForm = reactive({ productId: '', quantity: 1, unitCost: null as number | null, expiresOn: '' })

const canManageInventory = computed(() => canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier'))
const productItems = computed(() => products.value.filter(product => product.active).map(product => ({ label: `${product.name} (${product.stock_available})`, value: product.id })))
const activeProducts = computed(() => products.value.filter(product => product.active))
const lowStockProducts = computed(() => activeProducts.value.filter(product => product.stock_available <= 5))
const availableUnits = computed(() => activeProducts.value.reduce((total, product) => total + Number(product.stock_available), 0))

function formatMoney(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function productImageUrl(path: string | null) {
  const { $supabase } = useNuxtApp()
  return path && $supabase ? $supabase.storage.from('store-product-images').getPublicUrl(path).data.publicUrl : ''
}

function relationName(value: { name: string } | { name: string }[] | null) {
  return Array.isArray(value) ? value[0]?.name : value?.name
}

function clearProductPhoto() {
  if (productPhotoPreview.value) URL.revokeObjectURL(productPhotoPreview.value)
  productPhoto.value = null
  productPhotoPreview.value = ''
  productPhotoInputKey.value++
}

function selectProductPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  clearProductPhoto()
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    feedback.value = 'Escolha uma foto JPG, PNG ou WebP de até 5 MB.'
    return
  }
  productPhoto.value = file
  productPhotoPreview.value = URL.createObjectURL(file)
  feedback.value = ''
}

async function loadInventory() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !canManageInventory.value) {
    loading.value = false
    return
  }
  loading.value = true
  const [productsResult, batchesResult] = await Promise.all([
    $supabase.from('store_products').select('id, name, image_path, sale_price, stock_available, active').order('name'),
    $supabase.from('inventory_batches').select('id, product_id, quantity_received, quantity_on_hand, expires_on, created_at, product:store_products(name)').order('created_at', { ascending: false }).limit(20)
  ])
  products.value = (productsResult.data || []) as Product[]
  batches.value = (batchesResult.data || []) as unknown as InventoryBatch[]
  if (productsResult.error || batchesResult.error) feedback.value = 'Não foi possível carregar o estoque.'
  loading.value = false
}

async function createProduct() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !canManageInventory.value || !productForm.name.trim() || productForm.salePrice < 0) return
  saving.value = true
  const productId = crypto.randomUUID()
  let imagePath: string | null = null
  if (productPhoto.value) {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[productPhoto.value.type]
    if (!extension) {
      feedback.value = 'Escolha uma foto JPG, PNG ou WebP.'
      saving.value = false
      return
    }
    imagePath = `${productId}/photo.${extension}`
    const { error: uploadError } = await $supabase.storage.from('store-product-images').upload(imagePath, productPhoto.value, {
      contentType: productPhoto.value.type,
      cacheControl: '3600',
      upsert: false
    })
    if (uploadError) {
      feedback.value = 'Não foi possível enviar a foto. O produto não foi cadastrado.'
      saving.value = false
      return
    }
  }
  const { error } = await $supabase.from('store_products').insert({
    id: productId, name: productForm.name.trim(), description: productForm.description.trim() || null,
    sale_price: productForm.salePrice, created_by: auth.profile.id,
    ...(imagePath ? { image_path: imagePath } : {})
  })
  saving.value = false
  if (error) {
    if (imagePath) await $supabase.storage.from('store-product-images').remove([imagePath])
    feedback.value = 'Não foi possível cadastrar o produto.'
  } else {
    productForm.name = ''
    productForm.description = ''
    productForm.salePrice = 0
    clearProductPhoto()
    feedback.value = 'Produto cadastrado. Agora adicione uma entrada de estoque.'
    await loadInventory()
  }
}

async function addBatch() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !canManageInventory.value || !batchForm.productId || batchForm.quantity <= 0) return
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
    await loadInventory()
  }
}

onMounted(() => {
  if (!canManageInventory.value) {
    void navigateTo('/operacao')
    return
  }
  void loadInventory()
})
onUnmounted(() => {
  if (productPhotoPreview.value) URL.revokeObjectURL(productPhotoPreview.value)
})
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="saving"
      label="Atualizando estoque…"
    />
    <PageIntro
      title="Controle de estoque"
      description="Cadastre produtos, registre entradas por lote e acompanhe os saldos disponíveis para venda."
      icon="i-lucide-boxes"
    />
    <div class="mt-5 flex flex-wrap gap-2">
      <UButton
        to="/operacao"
        label="Voltar ao caixa"
        icon="i-lucide-arrow-left"
        color="neutral"
        variant="outline"
      />
      <UButton
        label="Atualizar estoque"
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        :loading="loading"
        @click="loadInventory"
      />
    </div>
    <UAlert
      v-if="feedback"
      class="mt-5"
      color="neutral"
      variant="subtle"
      :description="feedback"
    />
    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando estoque…"
    />
    <div
      v-if="canManageInventory"
      class="mt-6 grid gap-3 sm:grid-cols-3"
    >
      <UCard>
        <p class="text-sm text-muted">
          Produtos ativos
        </p><p class="mt-1 text-2xl font-bold">
          {{ activeProducts.length }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          Unidades disponíveis
        </p><p class="mt-1 text-2xl font-bold">
          {{ availableUnits }}
        </p>
      </UCard>
      <UCard>
        <p class="text-sm text-muted">
          Precisam de reposição
        </p><p class="mt-1 text-2xl font-bold text-warning">
          {{ lowStockProducts.length }}
        </p>
      </UCard>
    </div>
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
              label="Foto do produto (opcional)"
              hint="JPG, PNG ou WebP de até 5 MB"
            >
              <UInput
                :key="productPhotoInputKey"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="w-full"
                @change="selectProductPhoto"
              />
            </UFormField>
            <div
              v-if="productPhotoPreview"
              class="flex items-center gap-3"
            >
              <img
                :src="productPhotoPreview"
                alt="Prévia da foto do produto"
                class="size-20 rounded-xl object-cover"
              >
              <UButton
                label="Remover foto"
                color="neutral"
                variant="ghost"
                icon="i-lucide-x"
                @click="clearProductPhoto"
              />
            </div>
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

    <section
      v-if="canManageInventory"
      class="mt-8"
    >
      <div class="flex items-end justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Saldo atual
          </p>
          <h2 class="mt-1 text-2xl font-bold">
            Visão do estoque
          </h2>
          <p class="mt-1 text-sm text-muted">
            O saldo já considera as reservas de pedidos em aberto.
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chart-no-axes-combined"
            label="Ver relatórios"
            to="/operacao/relatorios"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="loading"
            label="Atualizar"
            @click="loadInventory()"
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
          <img
            v-if="product.image_path"
            :src="productImageUrl(product.image_path)"
            :alt="product.name"
            class="mb-4 aspect-video w-full rounded-xl object-cover"
            loading="lazy"
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

    <section
      v-if="canManageInventory"
      class="mt-8"
    >
      <h2 class="text-xl font-bold">
        Entradas recentes
      </h2>
      <p class="mt-1 text-sm text-muted">
        Últimos lotes registrados e saldo restante em cada lote.
      </p>
      <div class="mt-4 space-y-2">
        <div
          v-for="batch in batches"
          :key="batch.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-default p-3"
        >
          <div>
            <p class="font-semibold">
              {{ relationName(batch.product) || 'Produto' }}
            </p><p class="text-sm text-muted">
              {{ new Date(batch.created_at).toLocaleDateString('pt-BR') }} · {{ batch.quantity_received }} recebidos · {{ batch.quantity_on_hand }} restantes
            </p>
          </div>
          <UBadge
            v-if="batch.expires_on"
            color="neutral"
            variant="subtle"
            :label="`Validade ${new Date(`${batch.expires_on}T12:00:00`).toLocaleDateString('pt-BR')}`"
          />
        </div>
        <p
          v-if="!batches.length && !loading"
          class="rounded-xl border border-dashed border-default p-5 text-sm text-muted"
        >
          Nenhuma entrada registrada.
        </p>
      </div>
    </section>
  </div>
</template>
