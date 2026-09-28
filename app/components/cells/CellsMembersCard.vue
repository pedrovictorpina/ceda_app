<script setup lang="ts">
import type { CellDetail, CellMember } from '~/types/domain'
import { cellErrorMessage } from '~/utils/cellDirectory'

const props = defineProps<{ detail: CellDetail, manager: boolean }>()

const toast = useToast()
const cellStore = useCellsStore()
const inviteEmail = ref('')
const removingId = ref('')
const invitationStatusLabels = { pending: 'Pendente', accepted: 'Aceito', declined: 'Recusado', revoked: 'Revogado' } as const

function fail(caught: unknown, fallback: string) {
  toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, fallback), color: 'error', icon: 'i-lucide-circle-alert' })
}

async function invite() {
  const email = inviteEmail.value.trim()
  if (!email) return
  try {
    await cellStore.inviteMember(props.detail.id, email)
    inviteEmail.value = ''
    toast.add({ title: 'Convite enviado', description: 'A pessoa verá o convite ao abrir Células.', color: 'success', icon: 'i-lucide-circle-check' })
  } catch (caught) {
    fail(caught, 'Não foi possível convidar. Confira se o e-mail já tem cadastro no app.')
  }
}

async function remove(member: CellMember) {
  if (!window.confirm(`Remover ${member.name} da célula?`)) return
  removingId.value = member.userId
  try {
    await cellStore.removeMember(props.detail.id, member.userId)
    toast.add({ title: `${member.name.split(' ')[0]} saiu da célula`, color: 'neutral', icon: 'i-lucide-info' })
  } catch (caught) {
    fail(caught, 'Não foi possível remover.')
  } finally {
    removingId.value = ''
  }
}

async function removeLeadership(member: CellMember) {
  try {
    await cellStore.removeLeader(props.detail.id, member.userId)
  } catch (caught) {
    fail(caught, 'Não foi possível remover a liderança. A célula precisa manter pelo menos um líder.')
  }
}
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl' }">
    <template #header>
      <h2 class="font-semibold">
        Membros
      </h2>
      <p class="mt-1 text-xs text-muted">
        Adicione pessoas já cadastradas no app ou envie um convite por e-mail.
      </p>
    </template>

    <CellsMemberSearch
      :cell-id="detail.id"
      :disabled="cellStore.demoMode"
    />

    <form
      class="mt-4 flex gap-2"
      @submit.prevent="invite"
    >
      <UInput
        v-model="inviteEmail"
        type="email"
        size="xl"
        placeholder="Ou convide por e-mail"
        aria-label="E-mail para convite"
        class="min-w-0 flex-1"
      />
      <UButton
        type="submit"
        size="xl"
        color="neutral"
        variant="soft"
        :disabled="cellStore.demoMode || !inviteEmail.trim()"
        label="Convidar"
      />
    </form>

    <ul class="mt-4 space-y-2">
      <li
        v-for="member in detail.members"
        :key="member.userId"
        class="flex items-center justify-between gap-3 rounded-2xl border border-default p-3"
      >
        <div class="min-w-0">
          <p class="truncate text-sm font-medium">
            {{ member.name }}
          </p>
          <p class="truncate text-xs text-muted">
            {{ member.email }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <UBadge
            v-if="member.isLeader"
            color="primary"
            variant="subtle"
          >
            Líder
          </UBadge>
          <UButton
            v-if="manager && member.isLeader"
            size="sm"
            color="neutral"
            variant="outline"
            :disabled="cellStore.demoMode"
            label="Remover liderança"
            class="min-h-11"
            @click="removeLeadership(member)"
          />
          <UButton
            v-if="!member.isLeader"
            color="error"
            variant="ghost"
            :disabled="cellStore.demoMode"
            :loading="removingId === member.userId"
            icon="i-lucide-user-minus"
            :aria-label="`Remover ${member.name}`"
            class="min-h-11 min-w-11 justify-center"
            @click="remove(member)"
          />
        </div>
      </li>
    </ul>

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
      Líderes não removem outros líderes; só a administração altera a liderança.
    </p>
  </UCard>
</template>
