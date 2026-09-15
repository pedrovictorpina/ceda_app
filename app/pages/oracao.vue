<script setup lang="ts">
type PrayerVisibility = 'private' | 'pastoral' | 'community'
interface PrayerItem { id: string, title: string, details: string, visibility: PrayerVisibility, status: 'active' | 'answered', createdAt: string }

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Motivos de oração' })

const auth = useAuthStore()
const open = ref(false)
const saving = ref(false)
const feedback = ref('')
const requests = ref<PrayerItem[]>([])
const form = reactive<{ title: string, details: string, visibility: PrayerVisibility }>({ title: '', details: '', visibility: 'private' })
const visibilityItems = [
  { label: 'Somente eu', value: 'private' },
  { label: 'Equipe pastoral', value: 'pastoral' },
  { label: 'Comunidade', value: 'community' }
]
const visibilityLabels: Record<PrayerVisibility, string> = { private: 'Somente eu', pastoral: 'Equipe pastoral', community: 'Comunidade' }

async function createPrayer() {
  if (!form.title.trim() || !auth.profile) return
  saving.value = true
  feedback.value = ''
  const localItem: PrayerItem = {
    id: crypto.randomUUID(),
    title: form.title.trim(),
    details: form.details.trim(),
    visibility: form.visibility,
    status: 'active',
    createdAt: 'Agora'
  }
  const { $supabase } = useNuxtApp()
  if ($supabase) {
    const { data, error } = await $supabase.from('prayer_requests').insert({
      author_id: auth.profile.id,
      title: localItem.title,
      details: localItem.details || null,
      visibility: localItem.visibility
    }).select('id').single()
    if (error) {
      feedback.value = 'Não foi possível salvar o pedido. Tente novamente.'
      saving.value = false
      return
    }
    localItem.id = data.id
  }
  requests.value.unshift(localItem)
  Object.assign(form, { title: '', details: '', visibility: 'private' })
  saving.value = false
  open.value = false
  feedback.value = 'Seu motivo de oração foi registrado com a privacidade escolhida.'
}

async function markAnswered(item: PrayerItem) {
  const { $supabase } = useNuxtApp()
  if ($supabase) {
    const { error } = await $supabase.from('prayer_requests').update({ status: 'answered' }).eq('id', item.id)
    if (error) {
      feedback.value = 'Não foi possível atualizar o pedido.'
      return
    }
  }
  item.status = 'answered'
  feedback.value = 'Que alegria! O pedido foi marcado como respondido.'
}

onMounted(async () => {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return
  const { data } = await $supabase
    .from('prayer_requests')
    .select('id, title, details, visibility, status, created_at')
    .eq('author_id', auth.profile.id)
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
  if (data) {
    requests.value = data.map(row => ({
      id: row.id,
      title: row.title,
      details: row.details || '',
      visibility: row.visibility,
      status: row.status === 'answered' ? 'answered' : 'active',
      createdAt: new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(row.created_at))
    }))
  }
})
</script>

<template>
  <div>
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
        label="Novo motivo"
        icon="i-lucide-plus"
        @click="open = true"
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
            @click="markAnswered(item)"
          />
        </div>
      </UCard>
    </div>

    <UCard v-else>
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
      description="Escolha o nível de privacidade antes de salvar."
    >
      <template #body>
        <form
          class="space-y-4"
          @submit.prevent="createPrayer"
        >
          <UFormField
            label="Título"
            required
          >
            <UInput
              v-model="form.title"
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
              class="w-full"
              :rows="4"
              placeholder="Acrescente apenas o que se sente confortável em compartilhar."
            />
          </UFormField>
          <UFormField label="Quem pode ver">
            <USelect
              v-model="form.visibility"
              :items="visibilityItems"
              class="w-full"
            />
          </UFormField>
          <div class="rounded-lg bg-elevated p-3 text-sm text-muted">
            <UIcon
              name="i-lucide-lock-keyhole"
              class="mr-1 inline size-4 text-primary"
            />A visibilidade pode ser alterada depois pela pessoa que criou o pedido.
          </div>
          <div class="flex justify-end gap-3">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              label="Cancelar"
              @click="open = false"
            />
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!form.title.trim()"
              label="Salvar motivo"
            />
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
