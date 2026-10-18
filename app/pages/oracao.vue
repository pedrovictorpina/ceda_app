<script setup lang="ts">
import type { FormError } from '@nuxt/ui'
import type { PrayerItem, PrayerVisibility } from '~/composables/usePrayerRequests'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Motivos de oração' })
const auth = useAuthStore()
const open = ref(false)
const feedback = ref('')
const { requests, loading, saving, loadError, actionError, load: loadPrayers, create, markAnswered: saveAnswered } = usePrayerRequests()
const form = reactive({ title: '', details: '', visibility: 'private' as PrayerVisibility })
const visibilityItems = [
  { label: 'Somente eu', value: 'private' },
  { label: 'Equipe pastoral', value: 'pastoral' },
  { label: 'Comunidade', value: 'community' }
]
const visibilityLabels: Record<PrayerVisibility, string> = { private: 'Somente eu', pastoral: 'Equipe pastoral', community: 'Comunidade' }
const hasDraft = computed(() => Boolean(form.title.trim() || form.details.trim()))

function validatePrayer(state: typeof form): FormError[] {
  return state.title.trim() ? [] : [{ name: 'title', message: 'Dê um título para reconhecer este pedido depois.' }]
}

async function createPrayer() {
  if (saving.value) return
  const submitted = JSON.stringify(form)
  feedback.value = ''
  const item = await create(form)
  if (!item) return
  if (JSON.stringify(form) === submitted) {
    Object.assign(form, { title: '', details: '', visibility: 'private' })
    open.value = false
  }
  feedback.value = 'Seu motivo de oração foi registrado com a privacidade escolhida.'
}

async function markAnswered(item: PrayerItem) {
  feedback.value = ''
  if (await saveAnswered(item)) feedback.value = 'Que alegria! O pedido foi marcado como respondido.'
}
watch(() => auth.profile?.id, () => {
  Object.assign(form, { title: '', details: '', visibility: 'private' })
  feedback.value = ''
  open.value = false
}, { flush: 'sync' })
onMounted(loadPrayers)
</script>

<template>
  <div>
    <AppUnsavedChanges :dirty="hasDraft" />
    <BrandLoadingStatus
      v-if="saving"
      label="Salvando oração…"
    />
    <PageIntro
      title="Motivos de oração"
      description="Compartilhe um pedido com privacidade controlada e acompanhe sua jornada de oração."
      icon="i-lucide-heart"
    />

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm text-muted">
        Você decide quem pode ver cada pedido.
      </p>
      <UButton
        :label="hasDraft ? 'Continuar pedido' : 'Novo motivo'"
        icon="i-lucide-plus"
        @click="open = true"
      />
      <UButton
        label="Atualizar"
        color="neutral"
        variant="outline"
        :loading="loading"
        :disabled="saving"
        @click="loadPrayers"
      />
    </div>

    <UAlert
      v-if="loadError || actionError"
      class="mb-5"
      color="error"
      :description="actionError || loadError"
      :actions="loadError ? [{ label: 'Tentar novamente', onClick: loadPrayers }] : undefined"
    />
    <div
      v-if="loading && !requests.length"
      class="space-y-4"
      aria-busy="true"
      aria-label="Carregando seus pedidos de oração"
    >
      <USkeleton
        v-for="n in 3"
        :key="n"
        class="h-40 w-full rounded-xl"
      />
    </div>

    <UAlert
      v-if="feedback"
      class="mb-5"
      color="primary"
      variant="subtle"
      title="Atualização"
      :description="feedback"
      close
      @update:open="feedback = ''"
    />

    <div
      v-if="requests.length"
      class="space-y-4"
    >
      <UCard
        v-for="item in requests"
        :key="item.id"
        :class="item.status === 'answered' ? 'border-success/30' : ''"
      >
        <div class="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div class="max-w-3xl">
            <div class="flex flex-wrap items-center gap-2">
              <UBadge
                :color="item.status === 'answered' ? 'success' : 'neutral'"
                variant="subtle"
                :label="item.status === 'answered' ? 'Respondido' : visibilityLabels[item.visibility]"
              />
              <span class="text-xs text-muted">{{ item.createdAt }}</span>
            </div>
            <h2 class="mt-3 text-lg font-semibold">
              {{ item.title }}
            </h2>
            <p
              v-if="item.details"
              class="mt-2 text-sm leading-6 text-muted"
            >
              {{ item.details }}
            </p>
          </div>
          <UButton
            v-if="item.status === 'active'"
            class="shrink-0"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-circle-check-big"
            label="Marcar como respondido"
            :disabled="saving"
            @click="markAnswered(item)"
          />
        </div>
      </UCard>
    </div>

    <UCard v-else-if="!loading && !loadError">
      <div class="py-10 text-center">
        <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <UIcon
            name="i-lucide-hand-heart"
            class="size-8"
          />
        </div>
        <h2 class="mt-4 text-lg font-semibold">
          Comece seu espaço de oração
        </h2>
        <p class="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">
          Registre algo pelo qual deseja orar. O pedido começa privado e só é compartilhado se você escolher.
        </p>
        <UButton
          class="mt-5"
          label="Registrar primeiro motivo"
          @click="open = true"
        />
      </div>
    </UCard>

    <UModal
      v-model:open="open"
      title="Novo motivo de oração"
      description="Escolha quem pode ver antes de salvar. Seu texto fica nesta tela enquanto você estiver aqui."
      :dismissible="!saving"
      :close="!saving"
    >
      <template #body>
        <UForm
          :state="form"
          :validate="validatePrayer"
          class="space-y-4"
          @submit="createPrayer"
        >
          <UAlert
            v-if="actionError"
            color="error"
            :description="actionError"
          />
          <UFormField
            name="title"
            label="Título"
            required
          >
            <UInput
              v-model="form.title"
              :disabled="saving"
              class="w-full"
              placeholder="Por que você deseja orar?"
            />
          </UFormField>
          <UFormField
            label="Detalhes"
            hint="Opcional"
          >
            <UTextarea
              v-model="form.details"
              :disabled="saving"
              class="w-full"
              :rows="4"
              placeholder="Acrescente apenas o que se sente confortável em compartilhar."
            />
          </UFormField>
          <UFormField label="Quem pode ver">
            <USelect
              v-model="form.visibility"
              :disabled="saving"
              :items="visibilityItems"
              class="w-full"
            />
          </UFormField>
          <div class="rounded-lg bg-elevated p-3 text-sm text-muted">
            <UIcon
              name="i-lucide-lock-keyhole"
              class="mr-1 inline size-4 text-primary"
            />Confira quem poderá ver o pedido antes de salvar. Seus novos pedidos começam privados.
          </div>
          <div class="flex justify-end gap-3">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              label="Continuar depois"
              :disabled="saving"
              @click="open = false"
            />
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!form.title.trim()"
              label="Salvar motivo"
            />
          </div>
        </UForm>
      </template>
    </UModal>
  </div>
</template>
