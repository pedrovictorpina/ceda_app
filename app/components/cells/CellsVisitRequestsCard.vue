<script setup lang="ts">
import type { CellVisitRequest } from '~/types/cells'
import { formatBrazilianPhone, leaderReplyGreeting, whatsappUrl } from '~/utils/cellContact'
import { cellErrorMessage, formatDateKey, VISIT_STATUS_LABELS } from '~/utils/cellDirectory'

const props = defineProps<{ cellId: string, cellName: string, highlightId?: string }>()

const toast = useToast()
const cellStore = useCellsStore()
const requests = useCellVisitRequests()
const { items, loading, busyId, error } = requests
const { avatarUrl } = useAvatarUrls()
const open = computed(() => items.value.filter(item => item.status !== 'closed'))
const closed = computed(() => items.value.filter(item => item.status === 'closed'))
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

onMounted(() => requests.load(props.cellId))

function requestedAt(item: CellVisitRequest) {
  return item.createdAt ? dateFormatter.format(new Date(item.createdAt)) : ''
}

async function addToCell(item: CellVisitRequest) {
  busyId.value = item.id
  try {
    await cellStore.addMember(props.cellId, item.requesterId)
    toast.add({ title: `${item.requesterName.split(' ')[0]} agora faz parte da célula`, color: 'success', icon: 'i-lucide-circle-check' })
    await requests.load(props.cellId)
  } catch (caught) {
    toast.add({ title: 'Não deu certo', description: cellErrorMessage(caught, 'Não foi possível adicionar à célula.'), color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busyId.value = ''
  }
}
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl' }">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="font-semibold">
          Pedidos de visita
        </h2>
        <UBadge
          v-if="open.length"
          color="primary"
          variant="solid"
        >
          {{ open.length }}
        </UBadge>
      </div>
      <p class="mt-1 text-xs text-muted">
        Pessoas que tocaram em "Quero visitar essa célula".
      </p>
    </template>

    <UAlert
      v-if="error"
      class="mb-3"
      color="error"
      variant="subtle"
      :description="error"
    />
    <div
      v-if="loading && !items.length"
      class="py-6 text-center"
    >
      <BrandLoader label="Carregando pedidos…" />
    </div>
    <p
      v-else-if="!open.length"
      class="text-sm text-muted"
    >
      Nenhum pedido em aberto no momento.
    </p>
    <ul
      v-else
      class="space-y-3"
    >
      <li
        v-for="item in open"
        :key="item.id"
        class="rounded-2xl border p-3"
        :class="item.id === highlightId ? 'border-primary bg-primary/5' : 'border-default'"
      >
        <div class="flex items-start gap-3">
          <UAvatar
            :src="avatarUrl(item.requesterAvatarPath)"
            :alt="item.requesterName"
            size="lg"
          />
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-medium">
                {{ item.requesterName }}
              </p>
              <UBadge
                :color="item.status === 'pending' ? 'warning' : 'info'"
                variant="subtle"
              >
                {{ VISIT_STATUS_LABELS[item.status] }}
              </UBadge>
            </div>
            <p class="text-xs text-muted">
              Pedido em {{ requestedAt(item) }}<template v-if="item.preferredDate">
                · Prefere {{ formatDateKey(item.preferredDate) }}
              </template>
            </p>
            <p
              v-if="item.message"
              class="mt-2 whitespace-pre-line rounded-xl bg-elevated/60 p-2 text-sm"
            >
              {{ item.message }}
            </p>
            <p
              v-if="!item.requesterPhone"
              class="mt-2 text-xs text-muted"
            >
              Sem telefone compartilhado. Responda pela notificação ou pessoalmente.
            </p>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            v-if="item.requesterPhone"
            :to="whatsappUrl(item.requesterPhone, leaderReplyGreeting(item.requesterName, cellName))"
            target="_blank"
            rel="noopener noreferrer"
            color="success"
            variant="soft"
            icon="i-lucide-message-circle"
            :label="`WhatsApp ${formatBrazilianPhone(item.requesterPhone)}`"
            class="min-h-11"
          />
          <UButton
            v-if="item.status === 'pending'"
            color="neutral"
            variant="soft"
            icon="i-lucide-phone-call"
            label="Marcar como contatado"
            class="min-h-11"
            :loading="busyId === item.id"
            @click="requests.setStatus(cellId, item.id, 'contacted')"
          />
          <UButton
            icon="i-lucide-user-plus"
            label="Adicionar à célula"
            class="min-h-11"
            :loading="busyId === item.id"
            @click="addToCell(item)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            label="Encerrar"
            class="min-h-11"
            :disabled="busyId === item.id"
            @click="requests.setStatus(cellId, item.id, 'closed')"
          />
        </div>
      </li>
    </ul>
    <p
      v-if="closed.length"
      class="mt-4 text-xs text-muted"
    >
      {{ closed.length }} pedido(s) encerrado(s) nos últimos 30 dias.
    </p>
  </UCard>
</template>
