<script setup lang="ts">
import type { ClassFormValue } from '~/types/children'
import type { ManagedClass } from '~/composables/useChildrenClasses'
import { CLASS_NOTES_MAX, formatAgeRange, hasErrors, MAX_CHILD_AGE, validateClassInput, type ClassFormErrors } from '~/utils/childAge'

const props = defineProps<{ item?: ManagedClass, saving: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [form: ClassFormValue] }>()

const form = reactive<ClassFormValue>({ name: '', minAge: 3, maxAge: 5, room: '', notes: '' })
const errors = ref<ClassFormErrors>({})
const ageItems = Array.from({ length: MAX_CHILD_AGE + 1 }, (_, age) => ({ label: age === 1 ? '1 ano' : `${age} anos`, value: age }))
const preview = computed(() => form.minAge <= form.maxAge ? formatAgeRange(form.minAge, form.maxAge) : '')

watch(open, (isOpen) => {
  if (!isOpen) return
  form.name = props.item?.name ?? ''
  form.minAge = props.item?.min_age ?? 3
  form.maxAge = props.item?.max_age ?? 5
  form.room = props.item?.room ?? ''
  form.notes = props.item?.notes ?? ''
  errors.value = {}
}, { immediate: true })

function submit() {
  errors.value = validateClassInput(form)
  if (!hasErrors(errors.value)) emit('submit', { ...form })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="item ? 'Editar turma' : 'Nova turma'"
    description="A faixa de idade vira a descrição da turma para os responsáveis."
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <form
        id="class-form"
        class="mx-auto w-full max-w-lg space-y-4"
        novalidate
        @submit.prevent="submit"
      >
        <UFormField
          label="Nome da turma"
          required
          :error="errors.name"
        >
          <UInput
            v-model="form.name"
            class="w-full"
            size="xl"
            maxlength="80"
            placeholder="Ex.: Jardim"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField
            label="De"
            :error="errors.minAge"
          >
            <USelect
              v-model="form.minAge"
              class="w-full"
              size="xl"
              :items="ageItems"
            />
          </UFormField>
          <UFormField
            label="Até"
            :error="errors.maxAge"
          >
            <USelect
              v-model="form.maxAge"
              class="w-full"
              size="xl"
              :items="ageItems"
            />
          </UFormField>
        </div>
        <p
          v-if="preview"
          class="rounded-xl bg-primary/5 px-3 py-2 text-sm"
        >
          Descrição: <strong class="text-primary">{{ preview }}</strong>
        </p>
        <UFormField
          label="Sala (opcional)"
          :error="errors.room"
        >
          <UInput
            v-model="form.room"
            class="w-full"
            size="xl"
            maxlength="80"
            placeholder="Ex.: Sala 2, térreo"
          />
        </UFormField>
        <UFormField
          label="Observações (opcional)"
          :error="errors.notes"
          :hint="`${form.notes.length}/${CLASS_NOTES_MAX}`"
        >
          <UTextarea
            v-model="form.notes"
            class="w-full"
            :rows="2"
            :maxlength="CLASS_NOTES_MAX"
            placeholder="Ex.: traga uma muda de roupa"
          />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="mx-auto flex w-full max-w-lg gap-2">
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
          form="class-form"
          size="xl"
          icon="i-lucide-check"
          :label="item ? 'Salvar' : 'Criar turma'"
          class="min-h-12 flex-[2] justify-center rounded-full"
          :loading="saving"
        />
      </div>
    </template>
  </UDrawer>
</template>
