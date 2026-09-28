<script setup lang="ts">
import type { CellLeaderProfile, CellLeaderProfileFormValue } from '~/types/cells'
import { formatBrazilianPhone, LEADER_BIO_MAX, validateLeaderProfile, type LeaderProfileErrors } from '~/utils/cellContact'

const props = defineProps<{ leader?: CellLeaderProfile, self: boolean, saving: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ submit: [form: CellLeaderProfileFormValue] }>()

const form = reactive<CellLeaderProfileFormValue>({ bio: '', whatsapp: '', instagram: '' })
const errors = ref<LeaderProfileErrors>({})

watch(open, (isOpen) => {
  if (!isOpen) return
  Object.assign(form, {
    bio: props.leader?.bio ?? '',
    whatsapp: props.leader?.whatsapp ? formatBrazilianPhone(props.leader.whatsapp) : '',
    instagram: props.leader?.instagram ?? ''
  })
  errors.value = {}
}, { immediate: true })

function submit() {
  errors.value = validateLeaderProfile(form)
  if (!Object.keys(errors.value).length) emit('submit', { ...form })
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :title="self ? 'Meu perfil de líder' : `Perfil de ${leader?.name ?? 'líder'}`"
    description="Aparece para todos os membros no diretório de células."
    :ui="{ content: 'max-h-[92dvh]', body: 'overflow-y-auto', footer: 'safe-bottom border-t border-default' }"
  >
    <template #body>
      <form
        id="leader-profile-form"
        class="mx-auto w-full max-w-lg space-y-4"
        novalidate
        @submit.prevent="submit"
      >
        <UFormField
          label="Resumo sobre você"
          :error="errors.bio"
          :hint="`${form.bio.length}/${LEADER_BIO_MAX}`"
        >
          <UTextarea
            v-model="form.bio"
            class="w-full"
            :rows="4"
            :maxlength="LEADER_BIO_MAX"
            placeholder="Ex.: Casados há 10 anos, pais da Lia. Amamos receber pessoas com um bom café."
          />
        </UFormField>
        <UFormField
          label="WhatsApp (opcional)"
          :error="errors.whatsapp"
          hint="Com DDD. Visível para membros do app."
        >
          <UInput
            v-model="form.whatsapp"
            class="w-full"
            size="xl"
            type="tel"
            inputmode="tel"
            autocomplete="tel-national"
            maxlength="20"
            icon="i-lucide-message-circle"
            placeholder="(11) 99999-0000"
          />
        </UFormField>
        <UFormField
          label="Instagram (opcional)"
          :error="errors.instagram"
        >
          <UInput
            v-model="form.instagram"
            class="w-full"
            size="xl"
            maxlength="60"
            autocapitalize="none"
            icon="i-lucide-at-sign"
            placeholder="seu.usuario"
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
          form="leader-profile-form"
          size="xl"
          icon="i-lucide-check"
          label="Salvar perfil"
          class="min-h-12 flex-[2] justify-center rounded-full"
          :loading="saving"
        />
      </div>
    </template>
  </UDrawer>
</template>
