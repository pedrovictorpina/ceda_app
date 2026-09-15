<script setup lang="ts">
import { canManageChurch } from '~/utils/authorization'
import { CELL_WEEKDAYS, cellScheduleLabel } from '~/utils/cells'

definePageMeta({ middleware: 'cells' })
useSeoMeta({ title: 'Células' })

const auth = useAuthStore()
const cellStore = useCellsStore()
const createOpen = ref(false)
const createForm = reactive({ name: '', description: '', weekday: 3, time: '20:00', leaderEmails: '' })
const manager = computed(() => canManageChurch(auth.profile))
const invitations = computed(() => cellStore.cells.filter(cell => cell.access === 'invited'))
const participatingCells = computed(() => cellStore.cells.filter(cell => cell.access !== 'invited'))
const weekdayItems = CELL_WEEKDAYS.map((label, value) => ({ label, value }))

const accessLabels = { manager: 'Administração', leader: 'Liderança', member: 'Membro', invited: 'Convite pendente' } as const

onMounted(() => cellStore.loadCells())

async function createCell() {
  try {
    await cellStore.createCell({
      name: createForm.name,
      description: createForm.description,
      weekday: createForm.weekday,
      time: createForm.time,
      leaderEmails: createForm.leaderEmails.split(/[;,\n]/)
    })
    createOpen.value = false
    Object.assign(createForm, { name: '', description: '', weekday: 3, time: '20:00', leaderEmails: '' })
  } catch {
    // The store exposes the safe message in the page alert.
  }
}

async function respond(invitationId: string | undefined, cellId: string, accepted: boolean) {
  if (!invitationId || cellStore.demoMode) return
  try {
    await cellStore.respondInvitation(invitationId, cellId, accepted)
  } catch {
    // The store exposes the safe message in the page alert.
  }
}
</script>

<template>
  <div>
    <PageIntro
      title="Células"
      description="Acompanhe sua célula, convites, comunicados e enquetes em um espaço privado."
      icon="i-lucide-house-heart"
    />

    <UAlert
      v-if="cellStore.demoMode"
      class="mb-5"
      color="warning"
      variant="subtle"
      title="Demonstração local"
      description="O Supabase não está configurado. Estes dados são fictícios, não concedem acesso e nenhuma ação é persistida."
    />
    <UAlert
      v-if="cellStore.errorMessage"
      class="mb-5"
      color="error"
      variant="subtle"
      title="Não foi possível concluir"
      :description="cellStore.errorMessage"
    />

    <div
      v-if="manager"
      class="mb-6"
    >
      <UButton
        icon="i-lucide-plus"
        :label="createOpen ? 'Fechar criação' : 'Criar célula'"
        @click="createOpen = !createOpen"
      />
      <UCard
        v-if="createOpen"
        class="mt-4"
      >
        <template #header>
          <h2 class="font-semibold">
            Nova célula
          </h2>
          <p class="mt-1 text-sm text-muted">
            Somente administradores e pastores criam células e atribuem a liderança inicial.
          </p>
        </template>
        <form
          class="grid gap-4 sm:grid-cols-2"
          @submit.prevent="createCell"
        >
          <UFormField
            label="Nome"
            required
          >
            <UInput
              v-model="createForm.name"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Descrição">
            <UInput
              v-model="createForm.description"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Dia do encontro">
            <USelect
              v-model="createForm.weekday"
              :items="weekdayItems"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Horário">
            <UInput
              v-model="createForm.time"
              type="time"
              class="w-full"
            />
          </UFormField>
          <UFormField
            class="sm:col-span-2"
            label="E-mails dos líderes"
            hint="Separe múltiplos e-mails por vírgula. Todos precisam já estar cadastrados."
            required
          >
            <UInput
              v-model="createForm.leaderEmails"
              type="text"
              class="w-full"
            />
          </UFormField>
          <div class="sm:col-span-2">
            <UButton
              type="submit"
              :loading="cellStore.saving"
              label="Criar e atribuir liderança"
            />
          </div>
        </form>
      </UCard>
    </div>

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
        >
          <h3 class="font-semibold">
            {{ cell.name }}
          </h3>
          <p class="mt-1 text-sm text-muted">
            {{ cell.description }}
          </p>
          <p class="mt-3 text-xs font-medium text-warning">
            O endereço só será exibido após aceitar o convite.
          </p>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="sm"
                :disabled="cellStore.demoMode"
                :loading="cellStore.saving"
                label="Aceitar"
                @click="respond(cell.pendingInvitationId, cell.id, true)"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                :disabled="cellStore.demoMode"
                label="Recusar"
                @click="respond(cell.pendingInvitationId, cell.id, false)"
              />
              <UButton
                size="sm"
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
      v-if="cellStore.loading"
      class="py-12 text-center text-muted"
    >
      Carregando células…
    </div>
    <div
      v-else-if="!participatingCells.length"
      class="rounded-xl border border-dashed border-default py-12 text-center"
    >
      <UIcon
        name="i-lucide-house-heart"
        class="mx-auto size-10 text-muted"
      />
      <h2 class="mt-3 font-semibold">
        {{ manager ? 'Nenhuma célula criada' : 'Você ainda não participa de uma célula' }}
      </h2>
      <p class="mx-auto mt-1 max-w-lg text-sm text-muted">
        {{ manager ? 'Crie a primeira célula e atribua ao menos um líder cadastrado.' : 'Quando uma liderança enviar um convite, ele aparecerá aqui para você aceitar ou recusar.' }}
      </p>
    </div>
    <div
      v-else
      class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      <UCard
        v-for="cell in participatingCells"
        :key="cell.id"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
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
          >
            {{ accessLabels[cell.access] }}
          </UBadge>
        </div>
        <p class="mt-4 flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-clock-3" />{{ cellScheduleLabel(cell.meetingWeekday, cell.meetingTime) }}
        </p>
        <template #footer>
          <UButton
            :to="`/celulas/${cell.id}`"
            size="sm"
            variant="soft"
            label="Abrir célula"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
