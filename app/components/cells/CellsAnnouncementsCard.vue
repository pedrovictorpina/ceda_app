<script setup lang="ts">
import type { CellDetail } from '~/types/domain'
import { cellErrorMessage } from '~/utils/cellDirectory'

const props = defineProps<{ detail: CellDetail, canManage: boolean }>()

const toast = useToast()
const cellStore = useCellsStore()
const draft = reactive({ title: '', body: '' })
const statusLabels = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const

async function run(action: () => Promise<void>, success: string) {
  try {
    await action()
    toast.add({ title: success, color: 'success', icon: 'i-lucide-circle-check' })
    return true
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível salvar o comunicado.'), color: 'error', icon: 'i-lucide-circle-alert' })
    return false
  }
}

async function create() {
  const ok = await run(() => cellStore.createAnnouncement(props.detail.id, draft.title, draft.body), 'Rascunho salvo')
  if (ok) Object.assign(draft, { title: '', body: '' })
}
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl' }">
    <template #header>
      <h2 class="font-semibold">
        Comunicados
      </h2>
    </template>
    <div
      v-if="detail.announcements.length"
      class="space-y-4"
    >
      <article
        v-for="item in detail.announcements"
        :key="item.id"
        class="rounded-2xl border border-default p-3"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-medium">
            {{ item.title }}
          </h3>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ statusLabels[item.status] }}
          </UBadge>
        </div>
        <p class="mt-2 whitespace-pre-line text-sm text-muted">
          {{ item.body }}
        </p>
        <div
          v-if="canManage && item.status !== 'archived'"
          class="mt-3 flex gap-2"
        >
          <UButton
            v-if="item.status === 'draft'"
            size="sm"
            class="min-h-11"
            :disabled="cellStore.demoMode"
            label="Publicar"
            @click="run(() => cellStore.setAnnouncementStatus(detail.id, item.id, 'published'), 'Comunicado publicado')"
          />
          <UButton
            size="sm"
            class="min-h-11"
            color="neutral"
            variant="outline"
            :disabled="cellStore.demoMode"
            label="Arquivar"
            @click="run(() => cellStore.setAnnouncementStatus(detail.id, item.id, 'archived'), 'Comunicado arquivado')"
          />
        </div>
      </article>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      Nenhum comunicado disponível.
    </p>

    <form
      v-if="canManage"
      class="mt-5 space-y-3 border-t border-default pt-4"
      @submit.prevent="create"
    >
      <p class="text-sm font-semibold">
        Novo comunicado
      </p>
      <UFormField
        label="Título"
        required
      >
        <UInput
          v-model="draft.title"
          class="w-full"
          size="xl"
          maxlength="160"
        />
      </UFormField>
      <UFormField
        label="Mensagem"
        required
      >
        <UTextarea
          v-model="draft.body"
          class="w-full"
          :rows="3"
        />
      </UFormField>
      <UButton
        type="submit"
        class="min-h-11"
        :disabled="cellStore.demoMode"
        label="Salvar rascunho"
      />
      <p class="text-xs text-muted">
        Ao publicar, o app cria notificações internas para membros e co-líderes.
      </p>
    </form>
  </UCard>
</template>
