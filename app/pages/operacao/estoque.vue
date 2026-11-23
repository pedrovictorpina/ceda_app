<script setup lang="ts">
import { canOperateStore } from '~/utils/authorization'
import { randomId } from '~/utils/randomId'
import { formatPriceInput, parsePriceInput } from '~/utils/moneyInput'

definePageMeta({ middleware: ['auth', 'operations', 'inventory'] })
useSeoMeta({ title: 'Controle de estoque' })

interface Product {
  id: string
  name: string
  description: string | null
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
  unit_cost: number | null
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
const editingProductId = ref<string | null>(null)
const deletingProductId = ref<string | null>(null)
const editForm = reactive({ name: '', description: '', salePrice: 0 })
const editPhoto = ref<File | null>(null)
const editPhotoPreview = ref('')
const editPhotoInputKey = ref(0)
const removeExistingPhoto = ref(false)
const showExcludedProducts = ref(false)
const productSearch = ref('')
const productModalOpen = ref(false)
const initialStock = reactive({ enabled: false, quantity: null as number | null, unitCost: null as number | null, expiresOn: '' })
const editBatches = ref<InventoryBatch[]>([])
const editBatchesLoading = ref(false)
const editBatchesError = ref(false)
const initialUnitCost = computed({
  get: () => initialStock.unitCost === null ? '' : String(initialStock.unitCost),
  set: (value: string) => { initialStock.unitCost = value === '' ? null : Number(value) }
})
const canCreateProduct = computed(() => productForm.name.trim().length >= 2 && productForm.name.trim().length <= 120
  && (!initialStock.enabled || (initialStock.quantity !== null && Number.isFinite(initialStock.quantity) && initialStock.quantity > 0
    && (initialStock.unitCost === null || (Number.isFinite(initialStock.unitCost) && initialStock.unitCost >= 0)))))
const productPriceInput = computed({
  get: () => formatPriceInput(productForm.salePrice),
  set: (value: string) => { productForm.salePrice = parsePriceInput(value) }
})
const editPriceInput = computed({
  get: () => formatPriceInput(editForm.salePrice),
  set: (value: string) => { editForm.salePrice = parsePriceInput(value) }
})

const canManageInventory = computed(() => canOperateStore(auth.profile))
const productItems = computed(() => products.value.filter(product => product.active).map(product => ({ label: `${product.name} (${product.stock_available})`, value: product.id })))
const activeProducts = computed(() => products.value.filter(product => product.active))
const visibleProducts = computed(() => {
  const term = productSearch.value.trim().toLocaleLowerCase('pt-BR')
  return activeProducts.value.filter(product => product.name.toLocaleLowerCase('pt-BR').includes(term))
})
const excludedProducts = computed(() => products.value.filter(product => !product.active))
const lowStockProducts = computed(() => activeProducts.value.filter(product => product.stock_available <= 5))
const availableUnits = computed(() => activeProducts.value.reduce((total, product) => total + Number(product.stock_available), 0))
const canSaveEdit = computed(() => editForm.name.trim().length >= 2
  && editForm.name.trim().length <= 120
  && typeof editForm.salePrice === 'number'
  && Number.isFinite(editForm.salePrice)
  && editForm.salePrice >= 0)

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

function selectProductPhoto(file: File) {
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

function clearEditPhoto() {
  if (editPhotoPreview.value) URL.revokeObjectURL(editPhotoPreview.value)
  editPhoto.value = null
  editPhotoPreview.value = ''
  editPhotoInputKey.value++
}

function selectEditPhoto(file: File) {
  clearEditPhoto()
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    feedback.value = 'Escolha uma foto JPG, PNG ou WebP de até 5 MB.'
    return
  }
  editPhoto.value = file
  editPhotoPreview.value = URL.createObjectURL(file)
  removeExistingPhoto.value = false
  feedback.value = ''
}

function cancelEdit() {
  editingProductId.value = null
  clearEditPhoto()
  removeExistingPhoto.value = false
}

async function startEdit(product: Product) {
  cancelEdit()
  feedback.value = ''
  deletingProductId.value = null
  editingProductId.value = product.id
  editForm.name = product.name
  editForm.description = product.description || ''
  editForm.salePrice = Number(product.sale_price)
  editBatches.value = []
  editBatchesError.value = false
  editBatchesLoading.value = true
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    editBatchesError.value = true
    editBatchesLoading.value = false
    return
  }
  const { data, error } = await $supabase.from('inventory_batches')
    .select('id, product_id, quantity_received, quantity_on_hand, unit_cost, expires_on, created_at')
    .eq('product_id', product.id).order('created_at', { ascending: false })
  if (editingProductId.value !== product.id) return
  editBatches.value = (data || []) as InventoryBatch[]
  editBatchesError.value = !!error
  editBatchesLoading.value = false
}

async function loadInventory() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !canManageInventory.value) {
    loading.value = false
    return
  }
  loading.value = true
  const [productsResult, batchesResult] = await Promise.all([
    $supabase.from('store_products').select('id, name, description, image_path, sale_price, stock_available, active').order('name'),
    $supabase.from('inventory_batches').select('id, product_id, quantity_received, quantity_on_hand, expires_on, created_at, product:store_products(name)').order('created_at', { ascending: false }).limit(20)
  ])
  products.value = (productsResult.data || []) as Product[]
  batches.value = (batchesResult.data || []) as unknown as InventoryBatch[]
  if (productsResult.error || batchesResult.error) feedback.value = 'Não foi possível carregar o estoque.'
  loading.value = false
}

async function saveProduct(product: Product) {
  const { $supabase } = useNuxtApp()
  const name = editForm.name.trim()
  const salePrice = Number(editForm.salePrice)
  if (!$supabase || !canManageInventory.value || editingProductId.value !== product.id || !canSaveEdit.value) return
  saving.value = true
  let newImagePath: string | null = null
  if (editPhoto.value) {
    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[editPhoto.value.type]
    if (!extension) {
      feedback.value = 'Escolha uma foto JPG, PNG ou WebP.'
      saving.value = false
      return
    }
    newImagePath = `${product.id}/photo-${randomId()}.${extension}`
    const { error } = await $supabase.storage.from('store-product-images').upload(newImagePath, editPhoto.value, {
      contentType: editPhoto.value.type,
      cacheControl: '3600',
      upsert: false
    })
    if (error) {
      feedback.value = 'Não foi possível enviar a nova foto. O produto não foi alterado.'
      saving.value = false
      return
    }
  }
  const imagePath = newImagePath || (removeExistingPhoto.value ? null : product.image_path)
  const { data, error } = await $supabase.from('store_products').update({
    name,
    description: editForm.description.trim() || null,
    sale_price: salePrice,
    ...(newImagePath || removeExistingPhoto.value ? { image_path: imagePath } : {})
  }).eq('id', product.id).select('id').single()
  if (error || !data) {
    if (newImagePath) await $supabase.storage.from('store-product-images').remove([newImagePath])
    feedback.value = 'Não foi possível salvar as alterações do produto.'
  } else {
    if (product.image_path && product.image_path !== imagePath) {
      void $supabase.storage.from('store-product-images').remove([product.image_path])
    }
    cancelEdit()
    feedback.value = 'Produto atualizado.'
    await loadInventory()
  }
  saving.value = false
}

async function setProductActive(product: Product, active: boolean) {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !canManageInventory.value) return
  saving.value = true
  const { data, error } = await $supabase.from('store_products').update({ active }).eq('id', product.id).select('id').single()
  if (error || !data) feedback.value = active ? 'Não foi possível restaurar o produto.' : 'Não foi possível excluir o produto da loja.'
  else {
    deletingProductId.value = null
    if (editingProductId.value === product.id) cancelEdit()
    feedback.value = active ? 'Produto restaurado no catálogo.' : 'Produto excluído da loja. Pedidos e movimentações anteriores foram preservados.'
    await loadInventory()
  }
  saving.value = false
}

async function createProduct() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile || !canManageInventory.value || !canCreateProduct.value || productForm.salePrice < 0) return
  saving.value = true
  const productId = randomId()
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
  if (error) {
    if (imagePath) await $supabase.storage.from('store-product-images').remove([imagePath])
    feedback.value = 'Não foi possível cadastrar o produto.'
  } else {
    let entryFailed = false
    if (initialStock.enabled && initialStock.quantity !== null) {
      const { error: batchError } = await $supabase.from('inventory_batches').insert({
        product_id: productId, quantity_received: initialStock.quantity, quantity_on_hand: initialStock.quantity,
        unit_cost: initialStock.unitCost, expires_on: initialStock.expiresOn || null, received_by: auth.profile.id
      })
      entryFailed = !!batchError
    }
    if (entryFailed) {
      batchForm.quantity = initialStock.quantity || 1
      batchForm.unitCost = initialStock.unitCost
      batchForm.expiresOn = initialStock.expiresOn
    }
    productForm.name = ''
    productForm.description = ''
    productForm.salePrice = 0
    clearProductPhoto()
    productModalOpen.value = false
    batchForm.productId = entryFailed || !initialStock.enabled ? productId : ''
    feedback.value = entryFailed ? 'Produto cadastrado, mas a entrada não foi registrada. Confira os dados em Entrada de estoque e tente novamente.' : initialStock.enabled ? 'Produto cadastrado e entrada de estoque registrada.' : 'Produto cadastrado. Agora adicione uma entrada de estoque.'
    initialStock.enabled = false
    initialStock.quantity = null
    initialStock.unitCost = null
    initialStock.expiresOn = ''
    await loadInventory()
  }
  saving.value = false
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
  if (editPhotoPreview.value) URL.revokeObjectURL(editPhotoPreview.value)
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
        to="#saldo-estoque"
        label="Consultar"
        icon="i-lucide-search"
        class="min-h-11"
      />
      <UButton
        to="#entrada-estoque"
        label="Entrada de estoque"
        color="neutral"
        variant="outline"
        class="min-h-11"
      />
      <UButton
        icon="i-lucide-refresh-cw"
        color="neutral"
        variant="outline"
        class="min-h-11 min-w-11 justify-center"
        aria-label="Atualizar estoque"
        :loading="loading"
        @click="loadInventory"
      />
    </div>
    <UButton
      v-if="canManageInventory && !productModalOpen"
      icon="i-lucide-plus"
      label="Novo produto"
      class="hide-while-typing fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-30 min-h-14 rounded-full px-5 shadow-xl md:bottom-6 md:right-8"
      @click="feedback = ''; productModalOpen = true"
    />
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
      class="mt-5 grid grid-cols-3 gap-2"
    >
      <UCard :ui="{ body: 'p-3 sm:p-4' }">
        <p class="text-xs text-muted">
          Produtos ativos
        </p><p class="mt-1 text-xl font-bold">
          {{ activeProducts.length }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-3 sm:p-4' }">
        <p class="text-xs text-muted">
          Unidades disponíveis
        </p><p class="mt-1 text-xl font-bold">
          {{ availableUnits }}
        </p>
      </UCard>
      <UCard :ui="{ body: 'p-3 sm:p-4' }">
        <p class="text-xs text-muted">
          Precisam de reposição
        </p><p class="mt-1 text-xl font-bold text-warning">
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
      <div>
        <UModal
          v-model:open="productModalOpen"
          title="Cadastrar produto"
          description="Informe os dados de venda e, se já tiver unidades, registre a primeira entrada."
          :dismissible="!saving"
          :close="!saving"
          :ui="{ content: 'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg', header: 'pr-14 pt-[max(1rem,env(safe-area-inset-top))]', close: 'top-[max(1rem,env(safe-area-inset-top))]', body: 'overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]' }"
        >
          <template #body>
            <div class="space-y-5">
              <UAlert
                v-if="feedback"
                color="error"
                variant="subtle"
                :description="feedback"
              />
              <div>
                <h3 class="font-semibold">
                  Dados do produto
                </h3>
                <p class="mt-1 text-sm text-muted">
                  Essas informações aparecem na loja.
                </p>
              </div>
              <UFormField
                label="Nome"
                hint="Como aparecerá para o membro"
              >
                <UInput
                  v-model="productForm.name"
                  placeholder="Ex.: Café coado"
                  icon="i-lucide-tag"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Descrição (opcional)">
                <UTextarea
                  v-model="productForm.description"
                  :rows="2"
                  placeholder="Ex.: Preparado na hora"
                  class="w-full"
                />
              </UFormField>
              <UFormField
                label="Preço de venda"
                description="Valor cobrado por unidade."
              >
                <UInput
                  v-model="productPriceInput"
                  type="text"
                  inputmode="numeric"
                  class="w-full"
                />
              </UFormField>
              <div class="border-t border-default pt-4">
                <h3 class="font-semibold">
                  Foto do produto
                </h3>
                <p class="mt-1 text-sm text-muted">
                  Opcional. A imagem será exibida na loja.
                </p>
              </div>
              <UFormField
                label="Foto do produto (opcional)"
                hint="JPG, PNG ou WebP de até 5 MB"
              >
                <StorePhotoPicker
                  :input-key="productPhotoInputKey"
                  @file="selectProductPhoto"
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
              <div class="space-y-4 border-t border-default pt-4">
                <div>
                  <h3 class="font-semibold">
                    Estoque inicial
                  </h3>
                  <p class="mt-1 text-sm text-muted">
                    Registre as unidades que você já tem. Você também pode fazer isso depois.
                  </p>
                </div>
                <UCheckbox
                  v-model="initialStock.enabled"
                  label="Adicionar estoque agora"
                />
                <div
                  v-if="initialStock.enabled"
                  class="space-y-4"
                >
                  <UFormField
                    label="Quantidade recebida"
                    description="Quantidade de unidades desta entrada."
                  >
                    <UInput
                      v-model.number="initialStock.quantity"
                      type="number"
                      inputmode="decimal"
                      min="0.001"
                      step="0.001"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField
                    label="Custo por unidade (opcional)"
                    description="Quanto custou cada unidade, não o valor total."
                  >
                    <UInput
                      v-model="initialUnitCost"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.01"
                      placeholder="Ex.: 3,50"
                      class="w-full"
                    />
                  </UFormField>
                  <UFormField
                    label="Validade (opcional)"
                    description="Data de validade das unidades desta entrada."
                  >
                    <AppDatePicker v-model="initialStock.expiresOn" />
                  </UFormField>
                </div>
              </div>
              <UButton
                block
                class="min-h-11"
                :loading="saving"
                :disabled="!canCreateProduct"
                label="Cadastrar produto"
                icon="i-lucide-plus"
                @click="createProduct"
              />
            </div>
          </template>
        </UModal>
        <UCard
          id="entrada-estoque"
          class="scroll-mt-4 overflow-hidden"
        >
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
      id="saldo-estoque"
      class="mt-8 scroll-mt-4"
    >
      <div class="flex flex-wrap items-end justify-between gap-3">
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
            v-if="excludedProducts.length"
            color="neutral"
            variant="outline"
            icon="i-lucide-archive"
            :label="showExcludedProducts ? 'Ocultar excluídos' : `Excluídos (${excludedProducts.length})`"
            @click="showExcludedProducts = !showExcludedProducts"
          />
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
      <UFormField
        label="Buscar no estoque"
        class="mt-4"
      >
        <UInput
          v-model="productSearch"
          icon="i-lucide-search"
          placeholder="Nome do produto"
          class="w-full sm:max-w-sm"
        />
      </UFormField>
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
          v-for="product in visibleProducts"
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
          <div class="mt-4 flex flex-wrap gap-2 border-t border-default pt-4">
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-pencil"
              label="Editar"
              :disabled="saving"
              @click="startEdit(product)"
            />
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              icon="i-lucide-trash-2"
              label="Excluir"
              :disabled="saving"
              @click="deletingProductId = product.id"
            />
          </div>
          <div
            v-if="deletingProductId === product.id"
            class="mt-4 rounded-xl border border-error/40 bg-error/5 p-3"
          >
            <p class="text-sm font-semibold">
              Excluir {{ product.name }} da loja?
            </p>
            <p class="mt-1 text-sm text-muted">
              O produto deixará de aparecer para venda e novas entradas. Pedidos e movimentações anteriores serão preservados.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <UButton
                size="sm"
                color="error"
                label="Confirmar exclusão"
                :loading="saving"
                @click="setProductActive(product, false)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="ghost"
                label="Cancelar"
                @click="deletingProductId = null"
              />
            </div>
          </div>
          <UModal
            :open="editingProductId === product.id"
            title="Editar produto"
            :description="`Atualize os dados de ${product.name} e confira o estoque por entrada.`"
            :dismissible="!saving"
            :close="!saving"
            :ui="{ content: 'left-0 top-0 h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100vw-2rem)] sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg', header: 'pr-14 pt-[max(1rem,env(safe-area-inset-top))]', close: 'top-[max(1rem,env(safe-area-inset-top))]', body: 'overflow-y-auto pb-[max(1rem,env(safe-area-inset-bottom))]' }"
            @update:open="!$event && cancelEdit()"
          >
            <template #body>
              <div class="space-y-4">
                <UAlert
                  v-if="feedback"
                  color="error"
                  variant="subtle"
                  :description="feedback"
                />
                <div>
                  <h3 class="font-semibold">
                    Dados do produto
                  </h3>
                  <p class="mt-1 text-sm text-muted">
                    Nome, descrição e preço exibidos na loja.
                  </p>
                </div>
                <UFormField label="Nome">
                  <UInput
                    v-model="editForm.name"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Descrição">
                  <UTextarea
                    v-model="editForm.description"
                    :rows="2"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Preço de venda">
                  <UInput
                    v-model="editPriceInput"
                    type="text"
                    inputmode="numeric"
                    class="w-full"
                  />
                </UFormField>
                <div class="border-t border-default pt-4">
                  <h3 class="font-semibold">
                    Foto do produto
                  </h3>
                  <p class="mt-1 text-sm text-muted">
                    {{ editPhotoPreview ? 'Prévia da nova foto' : removeExistingPhoto ? 'A foto será removida ao salvar.' : product.image_path ? 'Foto atual' : 'Nenhuma foto cadastrada.' }}
                  </p>
                  <img
                    v-if="editPhotoPreview || (product.image_path && !removeExistingPhoto)"
                    :src="editPhotoPreview || productImageUrl(product.image_path)"
                    alt="Prévia da foto do produto"
                    class="mt-3 size-28 rounded-xl object-cover"
                  >
                </div>
                <UFormField label="Escolher outra foto">
                  <StorePhotoPicker
                    :input-key="editPhotoInputKey"
                    @file="selectEditPhoto"
                  />
                </UFormField>
                <UButton
                  v-if="editPhotoPreview"
                  color="neutral"
                  variant="ghost"
                  class="min-h-11"
                  icon="i-lucide-undo-2"
                  label="Descartar nova foto"
                  @click="clearEditPhoto"
                />
                <UButton
                  v-if="product.image_path && !removeExistingPhoto && !editPhoto"
                  size="sm"
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-image-off"
                  label="Remover foto atual"
                  class="min-h-11"
                  @click="removeExistingPhoto = true"
                />
                <UButton
                  v-if="removeExistingPhoto"
                  color="neutral"
                  variant="ghost"
                  class="min-h-11"
                  label="Manter foto atual"
                  @click="removeExistingPhoto = false"
                />
                <div class="space-y-3 border-t border-default pt-4">
                  <div>
                    <h3 class="font-semibold">
                      Estoque e entradas
                    </h3>
                    <p class="mt-1 text-sm text-muted">
                      {{ product.stock_available }} unidades disponíveis para venda, descontadas as reservas.
                    </p>
                    <p class="mt-1 text-sm text-muted">
                      Cada entrada pode ter custo e validade diferentes. Para adicionar unidades, use Entrada de estoque.
                    </p>
                  </div>
                  <p
                    v-if="editBatchesLoading"
                    class="text-sm text-muted"
                  >
                    Carregando entradas…
                  </p>
                  <p
                    v-else-if="editBatchesError"
                    class="text-sm text-error"
                  >
                    Não foi possível carregar as entradas deste produto.
                  </p>
                  <p
                    v-else-if="!editBatches.length"
                    class="text-sm text-muted"
                  >
                    Nenhuma entrada registrada para este produto.
                  </p>
                  <div
                    v-for="batch in editBatches"
                    :key="batch.id"
                    class="rounded-lg border border-default p-3 text-sm"
                  >
                    <p class="font-medium">
                      Entrada em {{ new Date(batch.created_at).toLocaleDateString('pt-BR') }}
                    </p>
                    <p class="mt-1 text-muted">
                      {{ batch.quantity_received }} recebidas · {{ batch.quantity_on_hand }} em estoque neste lote
                    </p>
                    <p class="mt-1 text-muted">
                      Custo por unidade: {{ batch.unit_cost === null ? 'Não informado' : formatMoney(batch.unit_cost) }}
                    </p>
                    <p class="mt-1 text-muted">
                      Validade: {{ batch.expires_on ? new Date(`${batch.expires_on}T12:00:00`).toLocaleDateString('pt-BR') : 'Não informada' }}
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UButton
                    class="min-h-11"
                    icon="i-lucide-save"
                    label="Salvar alterações"
                    :loading="saving"
                    :disabled="!canSaveEdit"
                    @click="saveProduct(product)"
                  />
                  <UButton
                    class="min-h-11"
                    color="neutral"
                    variant="ghost"
                    label="Cancelar"
                    :disabled="saving"
                    @click="cancelEdit"
                  />
                </div>
              </div>
            </template>
          </UModal>
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
              Nenhum produto ativo
            </p><p class="mt-1 text-sm text-muted">
              {{ excludedProducts.length ? 'Cadastre um produto ou restaure um item excluído para disponibilizá-lo na loja.' : 'Cadastre o primeiro item e registre uma entrada para disponibilizá-lo na loja.' }}
            </p>
          </div>
        </UCard>
      </div>
      <p
        v-if="activeProducts.length && !visibleProducts.length"
        class="mt-4 text-sm text-muted"
      >
        Nenhum produto encontrado para esta busca.
      </p>
      <UAlert
        v-if="!loading && lowStockProducts.length"
        class="mt-4"
        color="warning"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="`${lowStockProducts.length} ${lowStockProducts.length === 1 ? 'item precisa' : 'itens precisam'} de reposição`"
        :description="`${lowStockProducts.map(product => product.name).join(', ')} ${lowStockProducts.length === 1 ? 'está' : 'estão'} com até 5 unidades disponíveis.`"
      />
      <div
        v-if="showExcludedProducts && excludedProducts.length"
        class="mt-6"
      >
        <h3 class="text-lg font-semibold">
          Produtos excluídos
        </h3>
        <p class="mt-1 text-sm text-muted">
          Estes itens estão fora da loja e da visão do estoque. Restaure um produto para voltar a exibi-lo.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <UCard
            v-for="product in excludedProducts"
            :key="product.id"
          >
            <div class="flex items-center justify-between gap-3">
              <span class="min-w-0 truncate font-medium">{{ product.name }}</span>
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-rotate-ccw"
                label="Restaurar"
                :loading="saving"
                @click="setProductActive(product, true)"
              />
            </div>
          </UCard>
        </div>
      </div>
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
