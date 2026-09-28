<script setup lang="ts">
import type { CellDirectoryEntry, CellVisitFormValue } from '~/types/cells'
import { visitGreeting, whatsappUrl } from '~/utils/cellContact'
import {
  addDays,
  cellShortScheduleLabel,
  firstLeaderWithWhatsapp,
  formatDateKey,
  VISIT_MAX_DAYS_AHEAD,
  VISIT_MESSAGE_MAX,
  VISIT_STATUS_LABELS,
  validateVisitForm,
  type VisitFormErrors
} from '~/utils/cellDirectory'
import { todayInTimeZone } from '~/utils/birthdays'

const props = defineProps<{
  entry?: CellDirectoryEntry
  requesterName: string
  sending: boolean
  error: string
  submit: (form: CellVisitFormValue) => Promise<boolean>
  cancel: () => Promise<boolean>
}>()
const open = defineModel<boolean>('open', { required: true })

const form = reactive<CellVisitFormValue>({ message: '', preferredDate: '', sharePhone: true })
const errors = ref<VisitFormErrors>({})
const today = ref(todayInTimeZone())
const maxDate = computed(() => addDays(today.value, VISIT_MAX_DAYS_AHEAD))
const openVisit = computed(() => props.entry?.myVisitRequest?.status === 'closed' ? undefined : props.entry?.myVisitRequest)
const whatsappLeader = computed(() => props.entry ? firstLeaderWithWhatsapp(props.entry.leaders) : undefined)
const whatsappLink = computed(() => whatsappLeader.value?.whatsapp && props.entry
  ? whatsappUrl(whatsappLeader.value.whatsapp, visitGreeting(props.requesterName, props.entry.name))
  : '')

watch(open, (isOpen) => {
  if (!isOpen) return
  today.value = todayInTimeZone()
  Object.assign(form, { message: '', preferredDate: '', sharePhone: true })
  errors.value = {}
})

async function send() {
  errors.value = validateVisitForm(form, today.value)
  if (Object.keys(errors.value).length) return
  await props.submit({ ...form })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="openVisit ? 'Seu pedido de visita' : 'Quero visitar essa célula'"
    :description="entry ? `${entry.name} · ${cellShortScheduleLabel(entry.meetingWeekday, entry.meetingTime)}` : ''"
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <div class="mx-auto w-full max-w-lg">
        <UAlert
          v-if="error"
          class="mb-4"
          color="error"
          variant="subtle"
          icon="i-lucide-circle-alert"
          :description="error"
        />

        <div
          v-if="openVisit"
          class="space-y-4 text-center"
        >
          <div class="mx-auto grid size-16 place-items-center rounded-full bg-success/10 text-success">
            <UIcon
              name="i-lucide-party-popper"
              class="size-8"
            />
          </div>
          <div>
            <p class="text-lg font-semibold">
              Pedido enviado para a liderança!
            </p>
            <p class="mt-1 text-sm text-muted">
              {{ VISIT_STATUS_LABELS[openVisit.status] }}<template v-if="openVisit.preferredDate">
                · Data sugerida {{ formatDateKey(openVisit.preferredDate) }}
              </template>
            </p>
          </div>
          <p class="text-sm text-muted">
            Os líderes receberam uma notificação no app. Se quiser, fale com eles agora mesmo.
          </p>
          <UButton
            v-if="whatsappLink"
            :to="whatsappLink"
            target="_blank"
            rel="noopener noreferrer"
            color="success"
            size="xl"
            icon="i-lucide-message-circle"
            :label="`Falar no WhatsApp com ${whatsappLeader?.name.split(' ')[0]}`"
            class="min-h-12 w-full justify-center rounded-full"
          />
        </div>

        <form
          v-else
          id="visit-form"
          class="space-y-4"
          novalidate
          @submit.prevent="send"
        >
          <p class="text-sm text-muted">
            A liderança recebe seu pedido no app e combina a visita com você. Não é preciso ser membro da igreja.
          </p>
          <UFormField
            label="Mensagem (opcional)"
            :error="errors.message"
            :hint="`${form.message.length}/${VISIT_MESSAGE_MAX}`"
          >
            <UTextarea
              v-model="form.message"
              class="w-full"
              :rows="3"
              :maxlength="VISIT_MESSAGE_MAX"
              placeholder="Conte um pouco sobre você ou tire uma dúvida"
            />
          </UFormField>
          <UFormField
            label="Data que prefere visitar (opcional)"
            :error="errors.preferredDate"
          >
            <UInput
              v-model="form.preferredDate"
              type="date"
              size="xl"
              class="w-full"
              :min="today"
              :max="maxDate"
            />
          </UFormField>
          <USwitch
            v-model="form.sharePhone"
            label="Compartilhar meu telefone com a liderança"
            description="Os líderes poderão chamar você no WhatsApp com o telefone do seu perfil."
          />
        </form>
      </div>
    </template>
    <template #footer>
      <div class="mx-auto flex w-full max-w-lg gap-2">
        <template v-if="openVisit">
          <UButton
            color="neutral"
            variant="ghost"
            size="xl"
            label="Cancelar pedido"
            class="min-h-12 flex-1 justify-center rounded-full"
            :loading="sending"
            @click="cancel()"
          />
          <UButton
            size="xl"
            label="Fechar"
            class="min-h-12 flex-1 justify-center rounded-full"
            @click="open = false"
          />
        </template>
        <template v-else>
          <UButton
            color="neutral"
            variant="ghost"
            size="xl"
            label="Agora não"
            class="min-h-12 flex-1 justify-center rounded-full"
            @click="open = false"
          />
          <UButton
            type="submit"
            form="visit-form"
            size="xl"
            icon="i-lucide-send"
            label="Enviar pedido"
            class="min-h-12 flex-[2] justify-center rounded-full"
            :loading="sending"
          />
        </template>
      </div>
    </template>
  </UDrawer>
</template>
