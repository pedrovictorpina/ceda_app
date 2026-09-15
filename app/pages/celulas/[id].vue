<script setup lang="ts">
import type { CellAddress } from '~/types/domain'
import { canManageChurch } from '~/utils/authorization'
import { CELL_WEEKDAYS, cellScheduleLabel } from '~/utils/cells'

definePageMeta({ middleware: 'cells' })

const route = useRoute()
const auth = useAuthStore()
const cellStore = useCellsStore()
const cellId = computed(() => String(route.params.id))
const detail = computed(() => cellStore.selected)
const manager = computed(() => canManageChurch(auth.profile))
const canManage = computed(() => detail.value?.access === 'leader' || detail.value?.access === 'manager')
const canViewPrivate = computed(() => detail.value && detail.value.access !== 'invited')
const accessLabel = computed(() => ({ invited: 'Convite pendente', member: 'Membro', leader: 'Liderança', manager: 'Administração' }[detail.value?.access || 'member']))
const weekdayItems = CELL_WEEKDAYS.map((label, value) => ({ label, value }))
const announcementStatusLabels = { draft: 'Rascunho', published: 'Publicado', archived: 'Arquivado' } as const
const pollStatusLabels = { draft: 'Rascunho', published: 'Publicada', closed: 'Encerrada' } as const
const invitationStatusLabels = { pending: 'Pendente', accepted: 'Aceito', declined: 'Recusado', revoked: 'Revogado' } as const

const basics = reactive({ name: '', description: '', weekday: 3, time: '20:00', active: true })
const address = reactive<CellAddress>({ addressLine: '', city: '', region: '', postalCode: '' })
const inviteEmail = ref('')
const leaderEmail = ref('')
const announcement = reactive({ title: '', body: '' })
const poll = reactive({ question: '', optionsText: 'Sim\nNão' })

watch(detail, (value) => {
  if (!value) return
  Object.assign(basics, {
    name: value.name,
    description: value.description || '',
    weekday: value.meetingWeekday ?? 3,
    time: value.meetingTime?.slice(0, 5) || '20:00',
    active: value.active
  })
  Object.assign(address, {
    addressLine: value.address?.addressLine || '',
    city: value.address?.city || '',
    region: value.address?.region || '',
    postalCode: value.address?.postalCode || ''
  })
}, { immediate: true })

onMounted(async () => {
  await cellStore.loadCell(cellId.value)
  if (detail.value) useSeoMeta({ title: detail.value.name })
})

async function safely(action: () => Promise<unknown>, clear?: () => void) {
  try {
    await action()
    clear?.()
  } catch {
    // The store exposes the safe message in the page alert.
  }
}
</script>

<template>
  <div>
    <div class="mb-5">
      <UButton
        to="/celulas"
        color="neutral"
        variant="ghost"
        icon="i-lucide-arrow-left"
        label="Voltar para células"
      />
    </div>

    <div
      v-if="cellStore.loading"
      class="py-12 text-center text-muted"
    >
      Carregando célula…
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
        <span class="text-sm text-muted">{{ cellScheduleLabel(detail.meetingWeekday, detail.meetingTime) }}</span>
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
      >
        <template #header>
          <h2 class="font-semibold">
            Convite pendente
          </h2>
        </template>
        <p class="text-sm text-muted">
          Aceite para participar. Endereço, membros, comunicados e enquetes permanecem privados até a aprovação.
        </p>
        <template #footer>
          <div class="flex gap-2">
            <UButton
              :disabled="cellStore.demoMode"
              label="Aceitar convite"
              @click="safely(() => cellStore.respondInvitation(cellStore.selected?.pendingInvitationId || '', cellId, true))"
            />
            <UButton
              color="neutral"
              variant="outline"
              :disabled="cellStore.demoMode"
              label="Recusar"
              @click="safely(() => cellStore.respondInvitation(cellStore.selected?.pendingInvitationId || '', cellId, false))"
            />
          </div>
        </template>
      </UCard>

      <template v-if="canViewPrivate">
        <div class="grid gap-5 lg:grid-cols-2">
          <UCard>
            <template #header>
              <h2 class="font-semibold">
                Encontro e endereço privado
              </h2>
              <p class="mt-1 text-xs text-muted">
                Visível apenas para membros aprovados, líderes e administração.
              </p>
            </template>
            <div v-if="detail.address">
              <p>{{ detail.address.addressLine }}</p>
              <p class="text-sm text-muted">
                {{ detail.address.city }} · {{ detail.address.region }}<span v-if="detail.address.postalCode"> · {{ detail.address.postalCode }}</span>
              </p>
            </div>
            <p
              v-else
              class="text-sm text-muted"
            >
              Endereço ainda não cadastrado.
            </p>
          </UCard>

          <UCard>
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
                class="rounded-lg border border-default p-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-medium">
                    {{ item.title }}
                  </h3><UBadge
                    color="neutral"
                    variant="subtle"
                  >
                    {{ announcementStatusLabels[item.status] }}
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
                    size="xs"
                    :disabled="cellStore.demoMode"
                    label="Publicar"
                    @click="safely(() => cellStore.setAnnouncementStatus(cellId, item.id, 'published'))"
                  />
                  <UButton
                    size="xs"
                    color="neutral"
                    variant="outline"
                    :disabled="cellStore.demoMode"
                    label="Arquivar"
                    @click="safely(() => cellStore.setAnnouncementStatus(cellId, item.id, 'archived'))"
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
          </UCard>
        </div>

        <UCard class="mt-5">
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
              class="rounded-lg border border-default p-4"
            >
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-medium">
                  {{ item.question }}
                </h3><UBadge
                  color="neutral"
                  variant="subtle"
                >
                  {{ pollStatusLabels[item.status] }}
                </UBadge>
              </div>
              <div class="mt-3 space-y-2">
                <button
                  v-for="option in item.options"
                  :key="option.id"
                  class="focus-ring flex w-full items-center justify-between rounded-lg border border-default px-3 py-2 text-left text-sm disabled:cursor-not-allowed disabled:opacity-70"
                  :disabled="cellStore.demoMode || item.status !== 'published' || Boolean(item.selectedOptionId) || canManage"
                  @click="safely(() => cellStore.vote(cellId, item.id, option.id))"
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
                  size="xs"
                  :disabled="cellStore.demoMode"
                  label="Publicar"
                  @click="safely(() => cellStore.setPollStatus(cellId, item.id, 'published'))"
                />
                <UButton
                  v-if="item.status === 'published'"
                  size="xs"
                  color="neutral"
                  variant="outline"
                  :disabled="cellStore.demoMode"
                  label="Encerrar"
                  @click="safely(() => cellStore.setPollStatus(cellId, item.id, 'closed'))"
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
        </UCard>

        <template v-if="canManage">
          <div class="mt-6 grid gap-5 xl:grid-cols-2">
            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Editar dados básicos
                </h2>
              </template>
              <form
                class="grid gap-4 sm:grid-cols-2"
                @submit.prevent="safely(() => cellStore.saveBasics(cellId, basics))"
              >
                <UFormField
                  label="Nome"
                  required
                >
                  <UInput
                    v-model="basics.name"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Descrição">
                  <UInput
                    v-model="basics.description"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Dia">
                  <USelect
                    v-model="basics.weekday"
                    :items="weekdayItems"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="Horário">
                  <UInput
                    v-model="basics.time"
                    type="time"
                    class="w-full"
                  />
                </UFormField>
                <UCheckbox
                  v-model="basics.active"
                  label="Célula ativa"
                />
                <div class="sm:col-span-2">
                  <UButton
                    type="submit"
                    :disabled="cellStore.demoMode"
                    :loading="cellStore.saving"
                    label="Salvar dados"
                  />
                </div>
              </form>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Editar endereço privado
                </h2>
              </template>
              <form
                class="grid gap-4 sm:grid-cols-2"
                @submit.prevent="safely(() => cellStore.saveAddress(cellId, address))"
              >
                <UFormField
                  class="sm:col-span-2"
                  label="Endereço"
                  required
                >
                  <UInput
                    v-model="address.addressLine"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Cidade"
                  required
                >
                  <UInput
                    v-model="address.city"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Estado/região"
                  required
                >
                  <UInput
                    v-model="address.region"
                    class="w-full"
                  />
                </UFormField>
                <UFormField label="CEP">
                  <UInput
                    v-model="address.postalCode"
                    class="w-full"
                  />
                </UFormField>
                <div class="sm:col-span-2">
                  <UButton
                    type="submit"
                    :disabled="cellStore.demoMode"
                    :loading="cellStore.saving"
                    label="Salvar endereço"
                  />
                </div>
              </form>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Membros e convites
                </h2>
                <p class="mt-1 text-xs text-muted">
                  Convites aceitam somente e-mails de usuários já cadastrados.
                </p>
              </template>
              <form
                class="mb-4 flex gap-2"
                @submit.prevent="safely(() => cellStore.inviteMember(cellId, inviteEmail), () => inviteEmail = '')"
              >
                <UInput
                  v-model="inviteEmail"
                  type="email"
                  placeholder="membro@exemplo.com"
                  class="flex-1"
                />
                <UButton
                  type="submit"
                  :disabled="cellStore.demoMode"
                  label="Convidar"
                />
              </form>
              <div class="space-y-2">
                <div
                  v-for="member in detail.members"
                  :key="member.userId"
                  class="flex items-center justify-between gap-3 rounded-lg border border-default p-3"
                >
                  <div>
                    <p class="text-sm font-medium">
                      {{ member.name }}
                    </p><p class="text-xs text-muted">
                      {{ member.email }}
                    </p>
                  </div>
                  <div class="flex items-center gap-2">
                    <UBadge
                      v-if="member.isLeader"
                      color="primary"
                      variant="subtle"
                    >
                      Líder
                    </UBadge>
                    <UButton
                      v-if="manager && member.isLeader"
                      size="xs"
                      color="neutral"
                      variant="outline"
                      :disabled="cellStore.demoMode"
                      label="Remover liderança"
                      @click="safely(() => cellStore.removeLeader(cellId, member.userId))"
                    />
                    <UButton
                      v-if="!member.isLeader"
                      size="xs"
                      color="error"
                      variant="ghost"
                      :disabled="cellStore.demoMode"
                      icon="i-lucide-user-minus"
                      aria-label="Remover membro"
                      @click="safely(() => cellStore.removeMember(cellId, member.userId))"
                    />
                  </div>
                </div>
              </div>
              <div
                v-if="detail.invitations.length"
                class="mt-4 border-t border-default pt-4"
              >
                <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                  Histórico de convites
                </p>
                <div
                  v-for="item in detail.invitations"
                  :key="item.id"
                  class="flex items-center justify-between gap-3 py-1 text-sm"
                >
                  <span class="truncate">{{ item.email }}</span>
                  <UBadge
                    color="neutral"
                    variant="subtle"
                  >
                    {{ invitationStatusLabels[item.status] }}
                  </UBadge>
                </div>
              </div>
              <p class="mt-4 text-xs text-muted">
                A liderança não pode remover outro líder pela lista de membros. O banco impede remover o último líder.
              </p>
            </UCard>

            <UCard v-if="manager">
              <template #header>
                <h2 class="font-semibold">
                  Atribuir liderança
                </h2>
              </template>
              <form
                class="flex gap-2"
                @submit.prevent="safely(() => cellStore.assignLeader(cellId, leaderEmail), () => leaderEmail = '')"
              >
                <UInput
                  v-model="leaderEmail"
                  type="email"
                  placeholder="lider@exemplo.com"
                  class="flex-1"
                />
                <UButton
                  type="submit"
                  :disabled="cellStore.demoMode"
                  label="Atribuir"
                />
              </form>
              <p class="mt-3 text-xs text-muted">
                Somente administradores e pastores atribuem ou removem líderes; autoatribuição é bloqueada por RLS e trigger.
              </p>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Novo comunicado
                </h2>
              </template>
              <form
                class="space-y-4"
                @submit.prevent="safely(() => cellStore.createAnnouncement(cellId, announcement.title, announcement.body), () => Object.assign(announcement, { title: '', body: '' }))"
              >
                <UFormField
                  label="Título"
                  required
                >
                  <UInput
                    v-model="announcement.title"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Mensagem"
                  required
                >
                  <UTextarea
                    v-model="announcement.body"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  type="submit"
                  :disabled="cellStore.demoMode"
                  label="Salvar rascunho"
                />
              </form>
              <p class="mt-3 text-xs text-muted">
                Ao publicar, o app cria notificações internas para membros e co-líderes. Push externo ainda não é enviado.
              </p>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Nova enquete
                </h2>
              </template>
              <form
                class="space-y-4"
                @submit.prevent="safely(() => cellStore.createPoll(cellId, poll.question, poll.optionsText.split('\n')), () => Object.assign(poll, { question: '', optionsText: 'Sim\nNão' }))"
              >
                <UFormField
                  label="Pergunta"
                  required
                >
                  <UInput
                    v-model="poll.question"
                    class="w-full"
                  />
                </UFormField>
                <UFormField
                  label="Opções"
                  hint="Uma opção por linha; mínimo de duas."
                  required
                >
                  <UTextarea
                    v-model="poll.optionsText"
                    class="w-full"
                  />
                </UFormField>
                <UButton
                  type="submit"
                  :disabled="cellStore.demoMode"
                  label="Criar rascunho"
                />
              </form>
            </UCard>
          </div>
        </template>
      </template>
    </template>

    <UAlert
      v-else
      color="error"
      variant="subtle"
      title="Sem acesso"
      :description="cellStore.errorMessage || 'Esta célula não existe ou não está disponível para sua conta.'"
    />
  </div>
</template>
