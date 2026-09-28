<script setup lang="ts">
import type { CellDetailsFormValue } from '~/types/cells'
import { CELL_DESCRIPTION_MAX, CELL_NAME_MAX, emptyCellDetailsForm, validateCellDetails, type CellDetailsErrors } from '~/utils/cellAddress'
import { CELL_WEEKDAYS } from '~/utils/cells'

const props = withDefaults(defineProps<{
  mode: 'create' | 'edit'
  initial?: CellDetailsFormValue
  saving: boolean
}>(), { initial: undefined })
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [payload: { details: CellDetailsFormValue, leaderEmails: string[] }] }>()

const form = reactive<CellDetailsFormValue>(emptyCellDetailsForm())
const leaderEmails = ref('')
const errors = ref<CellDetailsErrors & { leaderEmails?: string }>({})
const weekdayItems = [{ label: 'A definir', value: null as number | null }, ...CELL_WEEKDAYS.map((label, value) => ({ label, value: value as number | null }))]

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, props.initial ?? emptyCellDetailsForm())
  leaderEmails.value = ''
  errors.value = {}
}, { immediate: true })

function parseEmails(): string[] {
  return leaderEmails.value.split(/[;,\s]+/).map(value => value.trim()).filter(Boolean)
}

function submit() {
  const emails = parseEmails()
  errors.value = {
    ...validateCellDetails(form),
    ...(props.mode === 'create' && !emails.length ? { leaderEmails: 'Informe o e-mail de pelo menos um líder cadastrado.' } : {})
  }
  if (Object.values(errors.value).some(Boolean)) return
  emit('submit', { details: { ...form }, leaderEmails: emails })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="mode === 'create' ? 'Nova célula' : 'Editar célula'"
    :description="mode === 'create' ? 'Somente administradores e pastores criam células e escolhem a liderança inicial.' : 'Líderes e administração podem atualizar estes dados.'"
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <form
        id="cell-details-form"
        class="mx-auto grid w-full max-w-2xl gap-4 sm:grid-cols-2"
        novalidate
        @submit.prevent="submit"
      >
        <UFormField
          class="sm:col-span-2"
          label="Nome da célula"
          required
          :error="errors.name"
        >
          <UInput
            v-model="form.name"
            class="w-full"
            size="xl"
            :maxlength="CELL_NAME_MAX"
            placeholder="Ex.: Célula Esperança"
          />
        </UFormField>
        <UFormField
          label="Dia do encontro"
          :error="errors.weekday"
        >
          <USelect
            v-model="form.weekday"
            :items="weekdayItems"
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          label="Horário"
          :error="errors.time"
        >
          <UInput
            v-model="form.time"
            type="time"
            class="w-full"
            size="xl"
          />
        </UFormField>
        <UFormField
          class="sm:col-span-2"
          label="Descrição (opcional)"
          :error="errors.description"
          :hint="`${form.description.length}/${CELL_DESCRIPTION_MAX}`"
        >
          <UTextarea
            v-model="form.description"
            class="w-full"
            :rows="2"
            :maxlength="CELL_DESCRIPTION_MAX"
            placeholder="Para quem é a célula, como é o encontro…"
          />
        </UFormField>

        <p class="text-sm font-semibold sm:col-span-2">
          Endereço do encontro
        </p>
        <UFormField
          class="sm:col-span-2"
          label="Rua e número"
          :error="errors.addressLine"
        >
          <UInput
            v-model="form.addressLine"
            class="w-full"
            size="xl"
            maxlength="200"
            autocomplete="street-address"
            placeholder="Ex.: Rua das Flores, 100, apto 12"
          />
        </UFormField>
        <UFormField
          label="Bairro"
          :error="errors.neighborhood"
        >
          <UInput
            v-model="form.neighborhood"
            class="w-full"
            size="xl"
            maxlength="100"
          />
        </UFormField>
        <UFormField
          label="Cidade"
          :error="errors.city"
        >
          <UInput
            v-model="form.city"
            class="w-full"
            size="xl"
            maxlength="100"
            autocomplete="address-level2"
          />
        </UFormField>
        <UFormField
          label="Estado"
          :error="errors.region"
        >
          <UInput
            v-model="form.region"
            class="w-full"
            size="xl"
            maxlength="100"
            autocomplete="address-level1"
            placeholder="Ex.: SP"
          />
        </UFormField>
        <UFormField
          label="CEP (opcional)"
          :error="errors.postalCode"
        >
          <UInput
            v-model="form.postalCode"
            class="w-full"
            size="xl"
            inputmode="numeric"
            maxlength="9"
            autocomplete="postal-code"
            placeholder="00000-000"
          />
        </UFormField>
        <USwitch
          v-model="form.showFullAddress"
          class="sm:col-span-2"
          label="Mostrar endereço completo no diretório"
          description="Desligado, quem ainda não participa vê só bairro e cidade. Membros sempre veem o endereço completo."
        />
        <USwitch
          v-if="mode === 'edit'"
          v-model="form.active"
          class="sm:col-span-2"
          label="Célula ativa"
          description="Células inativas saem do diretório e não recebem pedidos de visita."
        />

        <UFormField
          v-if="mode === 'create'"
          class="sm:col-span-2"
          label="E-mails dos líderes"
          hint="Separe por vírgula. Todos precisam já estar cadastrados."
          required
          :error="errors.leaderEmails"
        >
          <UInput
            v-model="leaderEmails"
            class="w-full"
            size="xl"
            type="text"
            inputmode="email"
            placeholder="lider@exemplo.com"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="mx-auto flex w-full max-w-2xl gap-2">
        <UButton
          color="neutral"
          variant="ghost"
          size="xl"
          label="Cancelar"
          class="min-h-12 flex-1 justify-center rounded-full"
          @click="open = false"
        />
        <UButton
          type="submit"
          form="cell-details-form"
          size="xl"
          icon="i-lucide-check"
          :label="mode === 'create' ? 'Criar célula' : 'Salvar'"
          class="min-h-12 flex-[2] justify-center rounded-full"
          :loading="saving"
        />
      </div>
    </template>
  </UDrawer>
</template>
