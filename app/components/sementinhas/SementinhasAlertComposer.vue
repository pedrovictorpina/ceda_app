<script setup lang="ts">
import type { ChildAlertReason } from '~/types/children'
import { ALERT_NOTE_MAX, CHILD_ALERT_REASONS, validateAlertInput } from '~/utils/childCheckin'

const props = defineProps<{ childName: string, sending: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ send: [payload: { reason: ChildAlertReason, note: string }] }>()

const reason = ref<ChildAlertReason>()
const note = ref('')
const error = ref('')
const reasons = [...CHILD_ALERT_REASONS]

watch(open, (isOpen) => {
  if (!isOpen) return
  reason.value = undefined
  note.value = ''
  error.value = ''
})

function send() {
  error.value = validateAlertInput(reason.value ?? null, note.value) ?? ''
  if (!error.value && reason.value) emit('send', { reason: reason.value, note: note.value })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Chamar responsável"
    :description="`Os responsáveis por ${props.childName} recebem o alerta no aplicativo.`"
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <div class="mx-auto w-full max-w-lg space-y-3">
        <URadioGroup
          v-model="reason"
          :items="reasons"
          variant="card"
          indicator="hidden"
          aria-label="Motivo do alerta"
          :ui="{ fieldset: 'grid gap-2 sm:grid-cols-2', item: 'min-h-14', label: 'flex-row gap-3 font-semibold', icon: 'size-5' }"
          @update:model-value="error = ''"
        />
        <UFormField
          :label="reason === 'other' ? 'Mensagem' : 'Complemento (opcional)'"
          :required="reason === 'other'"
          :hint="`${note.length}/${ALERT_NOTE_MAX}`"
        >
          <UTextarea
            v-model="note"
            class="w-full"
            :rows="2"
            :maxlength="ALERT_NOTE_MAX"
            placeholder="Ex.: traga a mamadeira"
          />
        </UFormField>
        <p
          v-if="error"
          class="text-sm font-medium text-error"
          role="alert"
        >
          {{ error }}
        </p>
      </div>
    </template>
    <template #footer>
      <div class="mx-auto w-full max-w-lg">
        <UButton
          block
          size="xl"
          icon="i-lucide-bell-ring"
          label="Enviar alerta"
          class="min-h-12 justify-center rounded-full"
          :loading="sending"
          @click="send"
        />
      </div>
    </template>
  </UDrawer>
</template>
