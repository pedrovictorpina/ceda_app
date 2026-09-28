<script setup lang="ts">
import type { ChildFormValue } from '~/types/children'
import type { FamilyChild } from '~/composables/useFamilyChildren'
import { birthDateBounds, CHILD_ALLERGIES_MAX, hasErrors, validateChildInput, type ChildFormErrors } from '~/utils/childAge'
import { CHILD_PHOTO_ACCEPT, validateChildPhoto } from '~/utils/childPhoto'

const props = defineProps<{ child?: FamilyChild, photoUrl: string, saving: boolean, removing: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{
  submit: [payload: { form: ChildFormValue, photo: File | null, removePhoto: boolean }]
  remove: []
}>()

const form = reactive<ChildFormValue>({ fullName: '', birthDate: '', allergies: '' })
const errors = ref<ChildFormErrors>({})
const photo = ref<File | null>(null)
const photoPreview = ref('')
const photoError = ref('')
const removeExistingPhoto = ref(false)
const confirmingRemoval = ref(false)
const inputKey = ref(0)
const bounds = computed(() => birthDateBounds())
const shownPhoto = computed(() => photoPreview.value || (removeExistingPhoto.value ? '' : props.photoUrl))

function clearPhoto() {
  if (photoPreview.value) URL.revokeObjectURL(photoPreview.value)
  photo.value = null
  photoPreview.value = ''
  inputKey.value++
}

function reset() {
  form.fullName = props.child?.full_name ?? ''
  form.birthDate = props.child?.birth_date ?? ''
  form.allergies = props.child?.allergies ?? ''
  errors.value = {}
  photoError.value = ''
  removeExistingPhoto.value = false
  confirmingRemoval.value = false
  clearPhoto()
}

watch(open, (isOpen) => {
  if (isOpen) reset()
  else clearPhoto()
}, { immediate: true })

function selectPhoto(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  clearPhoto()
  photoError.value = ''
  if (!file) return
  const problem = validateChildPhoto(file)
  if (problem) {
    photoError.value = problem
    return
  }
  photo.value = file
  photoPreview.value = URL.createObjectURL(file)
  removeExistingPhoto.value = false
}

function dropPhoto() {
  clearPhoto()
  removeExistingPhoto.value = Boolean(props.child?.photo_path)
}

function submit() {
  errors.value = validateChildInput(form)
  if (hasErrors(errors.value) || photoError.value) return
  emit('submit', { form: { ...form }, photo: photo.value, removePhoto: removeExistingPhoto.value })
}

onUnmounted(clearPhoto)
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="child ? 'Editar criança' : 'Cadastrar criança'"
    :description="child ? 'Atualize os dados que a equipe infantil vê.' : 'Você será o responsável por esta criança no Sementinhas.'"
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <form
        id="child-form"
        class="mx-auto w-full max-w-lg space-y-4"
        novalidate
        @submit.prevent="submit"
      >
        <div class="flex items-center gap-4">
          <SementinhasChildAvatar
            :name="form.fullName || 'Criança'"
            :url="shownPhoto"
            size="lg"
          />
          <div class="min-w-0 flex-1 space-y-2">
            <label class="block">
              <span class="sr-only">Foto da criança (opcional)</span>
              <input
                :key="inputKey"
                type="file"
                :accept="CHILD_PHOTO_ACCEPT"
                class="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-full file:border-0 file:bg-primary/10 file:px-4 file:font-semibold file:text-primary"
                @change="selectPhoto"
              >
            </label>
            <UButton
              v-if="shownPhoto"
              size="sm"
              color="neutral"
              variant="ghost"
              icon="i-lucide-image-off"
              label="Remover foto"
              @click="dropPhoto"
            />
            <p
              class="text-xs"
              :class="photoError ? 'text-error' : 'text-muted'"
            >
              {{ photoError || 'Opcional. JPG, PNG ou WebP de até 5 MB. Só responsáveis e equipe infantil veem.' }}
            </p>
          </div>
        </div>

        <UFormField
          label="Nome da criança"
          required
          :error="errors.fullName"
        >
          <UInput
            v-model="form.fullName"
            class="w-full"
            size="xl"
            autocomplete="off"
            maxlength="120"
            placeholder="Ex.: Ana Clara Souza"
          />
        </UFormField>

        <UFormField
          label="Data de nascimento"
          required
          hint="A idade é calculada automaticamente"
          :error="errors.birthDate"
        >
          <UInput
            v-model="form.birthDate"
            class="w-full"
            size="xl"
            type="date"
            :min="bounds.min"
            :max="bounds.max"
          />
        </UFormField>

        <UFormField
          label="Alergias ou cuidados especiais (opcional)"
          :error="errors.allergies"
          :hint="`${form.allergies.length}/${CHILD_ALLERGIES_MAX}`"
        >
          <UTextarea
            v-model="form.allergies"
            class="w-full"
            :rows="2"
            :maxlength="CHILD_ALLERGIES_MAX"
            placeholder="Ex.: alergia a amendoim"
          />
        </UFormField>

        <div
          v-if="child"
          class="rounded-2xl border border-error/30 p-3"
        >
          <UButton
            v-if="!confirmingRemoval"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            label="Remover criança"
            @click="confirmingRemoval = true"
          />
          <div
            v-else
            class="space-y-3"
          >
            <p class="text-sm">
              Remover <strong>{{ child.full_name }}</strong>? Se você for o único responsável, o cadastro, a foto e o histórico de check-in serão apagados.
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="error"
                icon="i-lucide-trash-2"
                label="Sim, remover"
                :loading="removing"
                @click="emit('remove')"
              />
              <UButton
                color="neutral"
                variant="ghost"
                label="Cancelar"
                @click="confirmingRemoval = false"
              />
            </div>
          </div>
        </div>
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
          form="child-form"
          size="xl"
          icon="i-lucide-check"
          :label="child ? 'Salvar' : 'Cadastrar'"
          class="min-h-12 flex-[2] justify-center rounded-full"
          :loading="saving"
          :disabled="removing"
        />
      </div>
    </template>
  </UDrawer>
</template>
