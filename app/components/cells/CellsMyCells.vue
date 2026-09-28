<script setup lang="ts">
import { cellShortScheduleLabel, cellErrorMessage } from '~/utils/cellDirectory'

defineProps<{ manager: boolean }>()
const emit = defineEmits<{ find: [] }>()

const toast = useToast()
const cellStore = useCellsStore()
const invitations = computed(() => cellStore.cells.filter(cell => cell.access === 'invited'))
const participating = computed(() => cellStore.cells.filter(cell => cell.access !== 'invited'))
const accessLabels = { manager: 'Administração', leader: 'Liderança', member: 'Membro', invited: 'Convite pendente' } as const

async function respond(invitationId: string | undefined, cellId: string, accepted: boolean) {
  if (!invitationId || cellStore.demoMode) return
  try {
    await cellStore.respondInvitation(invitationId, cellId, accepted)
    toast.add({ title: accepted ? 'Bem-vindo(a) à célula!' : 'Convite recusado', color: accepted ? 'success' : 'neutral', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível responder ao convite.'), color: 'error', icon: 'i-lucide-circle-alert' })
  }
}
</script>

<template>
  <div>
    <section
      v-if="invitations.length"
      class="mb-8"
    >
      <h2 class="mb-3 text-lg font-semibold">
        Convites pendentes
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <UCard
          v-for="cell in invitations"
          :key="cell.id"
          :ui="{ root: 'rounded-2xl' }"
        >
          <h3 class="font-semibold">
            {{ cell.name }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ cell.description }}
          </p>
          <p class="mt-3 text-xs font-medium text-warning">
            O endereço completo aparece após aceitar o convite.
          </p>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                class="min-h-11"
                :disabled="cellStore.demoMode"
                :loading="cellStore.saving"
                label="Aceitar"
                @click="respond(cell.pendingInvitationId, cell.id, true)"
              />
              <UButton
                class="min-h-11"
                color="neutral"
                variant="outline"
                :disabled="cellStore.demoMode"
                label="Recusar"
                @click="respond(cell.pendingInvitationId, cell.id, false)"
              />
              <UButton
                class="min-h-11"
                color="neutral"
                variant="ghost"
                :to="`/celulas/${cell.id}`"
                label="Ver convite"
              />
            </div>
          </template>
        </UCard>
      </div>
    </section>

    <div
      v-if="cellStore.loading && !cellStore.cells.length"
      class="py-12 text-center text-muted"
    >
      <BrandLoader label="Carregando células…" />
    </div>
    <div
      v-else-if="!participating.length"
      class="rounded-2xl border border-dashed border-default px-4 py-12 text-center"
    >
      <UIcon
        name="i-lucide-house-heart"
        class="mx-auto size-10 text-muted"
      />
      <h2 class="mt-3 font-semibold">
        {{ manager ? 'Nenhuma célula criada' : 'Você ainda não participa de uma célula' }}
      </h2>
      <p class="mx-auto mt-1 max-w-lg text-sm text-muted">
        {{ manager ? 'Crie a primeira célula e atribua ao menos um líder cadastrado.' : 'Encontre uma célula perto de você e peça para visitar. A liderança recebe seu pedido no app.' }}
      </p>
      <UButton
        v-if="!manager"
        class="mt-4 min-h-11 rounded-full"
        icon="i-lucide-search"
        label="Encontrar uma célula"
        @click="emit('find')"
      />
    </div>
    <div
      v-else
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <UCard
        v-for="cell in participating"
        :key="cell.id"
        :ui="{ root: 'rounded-2xl' }"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="font-semibold">
              {{ cell.name }}
            </h2>
            <p class="mt-1 text-sm text-muted">
              {{ cell.description || 'Sem descrição.' }}
            </p>
          </div>
          <UBadge
            color="neutral"
            variant="subtle"
            class="shrink-0"
          >
            {{ accessLabels[cell.access] }}
          </UBadge>
        </div>
        <p class="mt-4 flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-calendar-clock" />{{ cellShortScheduleLabel(cell.meetingWeekday, cell.meetingTime) }}
          <UBadge
            v-if="!cell.active"
            color="warning"
            variant="subtle"
          >
            Inativa
          </UBadge>
        </p>
        <template #footer>
          <UButton
            :to="`/celulas/${cell.id}`"
            variant="soft"
            label="Abrir célula"
            class="min-h-11 rounded-full"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
