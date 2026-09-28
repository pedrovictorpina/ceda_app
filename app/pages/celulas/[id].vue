<script setup lang="ts">
import type { CellDetailsFormValue, CellLeaderProfile, CellLeaderProfileFormValue, CellVisitFormValue } from '~/types/cells'
import { canManageChurch } from '~/utils/authorization'
import { cellErrorMessage, cellShortScheduleLabel } from '~/utils/cellDirectory'

definePageMeta({ middleware: 'cells' })

const route = useRoute()
const auth = useAuthStore()
const toast = useToast()
const cellStore = useCellsStore()
const directory = useCellDirectory()
const cellId = computed(() => String(route.params.id))
const highlightVisit = computed(() => typeof route.query.visita === 'string' ? route.query.visita : undefined)
const detail = computed(() => cellStore.selected?.id === cellId.value ? cellStore.selected : null)
const publicEntry = computed(() => detail.value ? undefined : directory.entries.value.find(entry => entry.id === cellId.value))
const manager = computed(() => canManageChurch(auth.profile))
const canManage = computed(() => detail.value?.access === 'leader' || detail.value?.access === 'manager')
const canViewPrivate = computed(() => Boolean(detail.value && detail.value.access !== 'invited'))
const myLeaderProfile = computed(() => detail.value?.leaders.find(leader => leader.userId === auth.profile?.id))
const editableLeaderIds = computed(() => manager.value
  ? (detail.value?.leaders ?? []).map(leader => leader.userId)
  : myLeaderProfile.value ? [myLeaderProfile.value.userId] : [])
const accessLabel = computed(() => ({ invited: 'Convite pendente', member: 'Membro', leader: 'Liderança', manager: 'Administração' }[detail.value?.access || 'member']))
const requesterName = computed(() => auth.profile?.name ?? '')
const booting = computed(() => (cellStore.loading || directory.loading.value) && !detail.value && !publicEntry.value)

const editOpen = ref(false)
const leadersOpen = ref(false)
const profileOpen = ref(false)
const visitOpen = ref(false)
const editingLeader = ref<CellLeaderProfile | undefined>()

const detailsInitial = computed<CellDetailsFormValue | undefined>(() => detail.value
  ? {
      name: detail.value.name,
      description: detail.value.description ?? '',
      weekday: detail.value.meetingWeekday ?? null,
      time: detail.value.meetingTime?.slice(0, 5) ?? '',
      active: detail.value.active,
      showFullAddress: detail.value.showFullAddress,
      addressLine: detail.value.address?.addressLine ?? '',
      neighborhood: detail.value.address?.neighborhood ?? '',
      city: detail.value.address?.city ?? '',
      region: detail.value.address?.region ?? '',
      postalCode: detail.value.address?.postalCode ?? ''
    }
  : undefined)

onMounted(async () => {
  await Promise.all([cellStore.loadCell(cellId.value), directory.load(cellId.value)])
  const name = detail.value?.name ?? publicEntry.value?.name
  if (name) useSeoMeta({ title: name })
})

function fail(caught: unknown, fallback: string) {
  toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, fallback), color: 'error', icon: 'i-lucide-circle-alert' })
}

async function saveDetails(payload: { details: CellDetailsFormValue }) {
  try {
    await cellStore.saveDetails(cellId.value, payload.details)
    editOpen.value = false
    toast.add({ title: 'Dados da célula salvos', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    fail(caught, 'Não foi possível salvar os dados da célula.')
  }
}

function editLeader(leader?: CellLeaderProfile) {
  editingLeader.value = leader
  leadersOpen.value = false
  profileOpen.value = true
}

async function saveLeaderProfile(form: CellLeaderProfileFormValue) {
  if (!editingLeader.value) return
  try {
    await cellStore.saveLeaderProfile(cellId.value, editingLeader.value.userId, form)
    profileOpen.value = false
    toast.add({ title: 'Perfil de líder salvo', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    fail(caught, 'Não foi possível salvar o perfil.')
  }
}

async function respondInvitation(accepted: boolean) {
  const invitationId = detail.value?.pendingInvitationId
  if (!invitationId) return
  try {
    await cellStore.respondInvitation(invitationId, cellId.value, accepted)
  } catch (caught) {
    fail(caught, 'Não foi possível responder ao convite.')
  }
}

async function submitVisit(form: CellVisitFormValue) {
  const ok = await directory.requestVisit(cellId.value, form)
  if (ok) toast.add({ title: 'Pedido enviado', description: 'A liderança foi avisada no app.', color: 'success', icon: 'i-lucide-circle-check' })
  return ok
}

async function cancelVisit() {
  const visit = publicEntry.value?.myVisitRequest
  if (!visit) return false
  const ok = await directory.cancelVisit(cellId.value, visit.id)
  if (ok) visitOpen.value = false
  return ok
}
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="cellStore.saving"
      label="Salvando célula…"
    />
    <div class="mb-5">
      <UButton
        to="/celulas"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Voltar para células"
        class="min-h-11"
      />
    </div>

    <div
      v-if="booting"
      class="py-12 text-center text-muted"
    >
      <BrandLoader label="Carregando célula…" />
    </div>

    <template v-else-if="detail">
      <PageIntro
        :title="detail.name"
        :description="detail.description || 'Espaço privado da célula.'"
        icon="i-lucide-house-heart"
      />
      <div class="mb-5 flex flex-wrap items-center gap-2">
        <UBadge
          color="neutral"
          variant="subtle"
        >
          {{ accessLabel }}
        </UBadge>
        <UBadge
          v-if="!detail.active"
          color="warning"
          variant="subtle"
        >
          Inativa
        </UBadge>
        <span class="text-sm text-muted">{{ cellShortScheduleLabel(detail.meetingWeekday, detail.meetingTime) }}</span>
      </div>

      <UAlert
        v-if="cellStore.demoMode"
        class="mb-5"
        color="warning"
        variant="subtle"
        title="Demonstração local"
        description="Conteúdo fictício e não persistido. Ações estão desativadas sem Supabase."
      />
      <UAlert
        v-if="cellStore.errorMessage"
        class="mb-5"
        color="error"
        variant="subtle"
        title="Não foi possível concluir"
        :description="cellStore.errorMessage"
      />

      <UCard
        v-if="detail.access === 'invited'"
        class="mb-6"
        :ui="{ root: 'rounded-2xl' }"
      >
        <h2 class="font-semibold">
          Convite pendente
        </h2>
        <p class="mt-1 text-sm text-muted">
          Aceite para participar. Endereço completo, membros, comunicados e enquetes aparecem após o aceite.
        </p>
        <div class="mt-4 flex gap-2">
          <UButton
            :disabled="cellStore.demoMode"
            label="Aceitar convite"
            class="min-h-11"
            @click="respondInvitation(true)"
          />
          <UButton
            color="neutral"
            variant="outline"
            :disabled="cellStore.demoMode"
            label="Recusar"
            class="min-h-11"
            @click="respondInvitation(false)"
          />
        </div>
      </UCard>

      <div
        v-if="canViewPrivate"
        class="grid gap-5 lg:grid-cols-2"
      >
        <CellsMeetingCard
          :detail="detail"
          :can-manage="canManage"
          @edit="editOpen = true"
          @leaders="leadersOpen = true"
        />
        <CellsVisitRequestsCard
          v-if="canManage && !cellStore.demoMode"
          :cell-id="detail.id"
          :cell-name="detail.name"
          :highlight-id="highlightVisit"
        />
        <UCard
          v-if="myLeaderProfile"
          :ui="{ root: 'rounded-2xl' }"
        >
          <h2 class="font-semibold">
            Seu perfil de líder
          </h2>
          <p class="mt-1 text-sm text-muted">
            {{ myLeaderProfile.bio || 'Escreva um resumo curto e informe WhatsApp e Instagram para quem quer conhecer a célula.' }}
          </p>
          <UButton
            class="mt-3 min-h-11"
            color="neutral"
            variant="soft"
            icon="i-lucide-user-pen"
            label="Editar meu perfil"
            :disabled="cellStore.demoMode"
            @click="editLeader(myLeaderProfile)"
          />
        </UCard>
        <CellsAnnouncementsCard
          :detail="detail"
          :can-manage="canManage"
        />
        <CellsPollsCard
          :detail="detail"
          :can-manage="canManage"
          class="lg:col-span-2"
        />
        <CellsMembersCard
          v-if="canManage"
          :detail="detail"
          :manager="manager"
        />
        <CellsLeadershipCard
          v-if="manager"
          :cell-id="detail.id"
        />
      </div>

      <CellsDetailsForm
        v-model:open="editOpen"
        mode="edit"
        :initial="detailsInitial"
        :saving="cellStore.saving"
        @submit="saveDetails"
      />
      <CellsLeadersModal
        v-model:open="leadersOpen"
        :leaders="detail.leaders"
        :cell-name="detail.name"
        :requester-name="requesterName"
        :editable-ids="cellStore.demoMode ? [] : editableLeaderIds"
        @edit="editLeader"
      />
      <CellsLeaderProfileDrawer
        v-model:open="profileOpen"
        :leader="editingLeader"
        :self="editingLeader?.userId === auth.profile?.id"
        :saving="cellStore.saving"
        @submit="saveLeaderProfile"
      />
    </template>

    <template v-else-if="publicEntry">
      <PageIntro
        :title="publicEntry.name"
        :description="publicEntry.description || 'Conheça a célula e combine uma visita com a liderança.'"
        icon="i-lucide-house-heart"
      />
      <div class="mx-auto max-w-xl">
        <CellsDirectoryCard
          :entry="publicEntry"
          :show-open-link="false"
          @leaders="leadersOpen = true"
          @visit="visitOpen = true"
        />
      </div>
      <CellsLeadersModal
        v-model:open="leadersOpen"
        :leaders="publicEntry.leaders"
        :cell-name="publicEntry.name"
        :requester-name="requesterName"
      />
      <CellsVisitDrawer
        v-model:open="visitOpen"
        :entry="publicEntry"
        :requester-name="requesterName"
        :sending="directory.sending.value"
        :error="directory.error.value"
        :submit="submitVisit"
        :cancel="cancelVisit"
      />
    </template>

    <UAlert
      v-else
      color="error"
      variant="subtle"
      title="Sem acesso"
      :description="directory.error.value || 'Esta célula não existe, está inativa ou não está disponível para sua conta.'"
    />
  </div>
</template>
