<script setup lang="ts">
import type { CellDetail } from '~/types/domain'
import { cellErrorMessage } from '~/utils/cellDirectory'

const props = defineProps<{ detail: CellDetail, canManage: boolean }>()

const toast = useToast()
const cellStore = useCellsStore()
const draft = reactive({ question: '', optionsText: 'Sim\nNão' })
const statusLabels = { draft: 'Rascunho', published: 'Publicada', closed: 'Encerrada' } as const

async function run(action: () => Promise<void>, success?: string) {
  try {
    await action()
    if (success) toast.add({ title: success, color: 'success', icon: 'i-lucide-circle-check' })
    return true
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível salvar a enquete.'), color: 'error', icon: 'i-lucide-circle-alert' })
    return false
  }
}

async function create() {
  const ok = await run(() => cellStore.createPoll(props.detail.id, draft.question, draft.optionsText.split('\n')), 'Rascunho de enquete criado')
  if (ok) Object.assign(draft, { question: '', optionsText: 'Sim\nNão' })
}
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl' }">
    <template #header>
      <h2 class="font-semibold">
        Enquetes
      </h2>
    </template>
    <div
      v-if="detail.polls.length"
      class="grid gap-4 lg:grid-cols-2"
    >
      <article
        v-for="item in detail.polls"
        :key="item.id"
        class="rounded-2xl border border-default p-4"
      >
        <div class="flex items-start justify-between gap-2">
          <h3 class="font-medium">
            {{ item.question }}
          </h3>
          <UBadge
            color="neutral"
            variant="subtle"
          >
            {{ statusLabels[item.status] }}
          </UBadge>
        </div>
        <div class="mt-3 space-y-2">
          <button
            v-for="option in item.options"
            :key="option.id"
            type="button"
            class="focus-ring flex min-h-11 w-full items-center justify-between rounded-xl border border-default px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-70"
            :disabled="cellStore.demoMode || item.status !== 'published' || Boolean(item.selectedOptionId) || canManage"
            @click="run(() => cellStore.vote(detail.id, item.id, option.id), 'Voto registrado')"
          >
            <span>{{ option.label }}</span>
            <span v-if="canManage">{{ option.votes }} voto(s)</span>
            <UIcon
              v-else-if="item.selectedOptionId === option.id"
              name="i-lucide-check-circle-2"
              class="text-primary"
            />
          </button>
        </div>
        <div
          v-if="canManage"
          class="mt-3 flex gap-2"
        >
          <UButton
            v-if="item.status === 'draft'"
            size="sm"
            class="min-h-11"
            :disabled="cellStore.demoMode"
            label="Publicar"
            @click="run(() => cellStore.setPollStatus(detail.id, item.id, 'published'), 'Enquete publicada')"
          />
          <UButton
            v-if="item.status === 'published'"
            size="sm"
            class="min-h-11"
            color="neutral"
            variant="outline"
            :disabled="cellStore.demoMode"
            label="Encerrar"
            @click="run(() => cellStore.setPollStatus(detail.id, item.id, 'closed'), 'Enquete encerrada')"
          />
        </div>
      </article>
    </div>
    <p
      v-else
      class="text-sm text-muted"
    >
      Nenhuma enquete disponível.
    </p>

    <form
      v-if="canManage"
      class="mt-5 space-y-3 border-t border-default pt-4"
      @submit.prevent="create"
    >
      <p class="text-sm font-semibold">
        Nova enquete
      </p>
      <UFormField
        label="Pergunta"
        required
      >
        <UInput
          v-model="draft.question"
          class="w-full"
          size="xl"
          maxlength="500"
        />
      </UFormField>
      <UFormField
        label="Opções"
        hint="Uma opção por linha; mínimo de duas."
        required
      >
        <UTextarea
          v-model="draft.optionsText"
          class="w-full"
          :rows="3"
        />
      </UFormField>
      <UButton
        type="submit"
        class="min-h-11"
        :disabled="cellStore.demoMode"
        label="Criar rascunho"
      />
    </form>
  </UCard>
</template>
