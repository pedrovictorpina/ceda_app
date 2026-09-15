<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Perfil' })
const auth = useAuthStore()
const form = reactive({ name: auth.profile?.name || '', email: auth.profile?.email || '', phone: '', sex: '', birthDate: '', notificationsEnabled: true })
const confirmDeletion = ref(false)
const requestStatus = ref('')
const saveStatus = ref('')
const savePending = ref(false)
const avatarInput = ref<HTMLInputElement>()
const avatarPath = ref<string | null>(null)
const avatarUrl = ref('')
const avatarStatus = ref('')
const avatarPending = ref(false)
const sexItems = [
  { label: 'Feminino', value: 'female' },
  { label: 'Masculino', value: 'male' },
  { label: 'Prefiro não informar', value: 'not_informed' }
]

const avatarInitials = computed(() => (auth.profile?.name || 'Membro')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join(''))

function openAvatarSelector() {
  avatarInput.value?.click()
}

async function loadAvatar(path: string) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  const { data, error } = await $supabase.storage.from('avatars').createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return
  avatarUrl.value = data.signedUrl
  if (auth.profile) auth.profile.avatarUrl = data.signedUrl
}

async function uploadAvatar(file: File) {
  if (!auth.profile) return
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    avatarStatus.value = 'Escolha uma imagem JPG, PNG ou WebP.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    avatarStatus.value = 'A foto deve ter no máximo 5 MB.'
    return
  }
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    avatarStatus.value = 'Não foi possível enviar a foto porque o serviço de dados está indisponível.'
    return
  }
  avatarPending.value = true
  avatarStatus.value = ''
  const path = `${auth.profile.id}/avatar`
  const { error: uploadError } = await $supabase.storage.from('avatars').upload(path, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: true
  })
  if (uploadError) {
    avatarStatus.value = 'Não foi possível enviar a foto. Tente novamente.'
    avatarPending.value = false
    return
  }
  const { error: profileError } = await $supabase.from('profiles').update({ avatar_path: path }).eq('id', auth.profile.id)
  if (profileError) {
    avatarStatus.value = 'A foto foi enviada, mas não foi possível associá-la ao perfil.'
    avatarPending.value = false
    return
  }
  avatarPath.value = path
  await loadAvatar(path)
  avatarStatus.value = 'Foto de perfil atualizada.'
  avatarPending.value = false
}

async function handleAvatarSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await uploadAvatar(file)
  input.value = ''
}

async function removeAvatar() {
  if (!auth.profile || !avatarPath.value) return
  const path = avatarPath.value
  if (path !== `${auth.profile.id}/avatar`) {
    avatarStatus.value = 'Não foi possível validar a foto de perfil para exclusão.'
    return
  }
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  avatarPending.value = true
  avatarStatus.value = ''
  const { error: profileError } = await $supabase.from('profiles').update({ avatar_path: null }).eq('id', auth.profile.id)
  if (profileError) {
    avatarStatus.value = 'Não foi possível excluir a foto. Tente novamente.'
    avatarPending.value = false
    return
  }
  const { error: deleteError } = await $supabase.storage.from('avatars').remove([path])
  avatarPath.value = null
  avatarUrl.value = ''
  auth.profile.avatarUrl = undefined
  avatarStatus.value = deleteError
    ? 'A foto foi removida do perfil, mas a limpeza do arquivo não foi concluída.'
    : 'Foto de perfil removida.'
  avatarPending.value = false
}

async function saveProfile() {
  if (!auth.profile || !form.name.trim()) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    saveStatus.value = 'Não foi possível salvar porque o serviço de dados está indisponível.'
    return
  }
  savePending.value = true
  saveStatus.value = ''
  const { error } = await $supabase.from('profiles').update({
    full_name: form.name.trim(),
    phone: form.phone.trim() || null,
    sex: form.sex || null,
    birth_date: form.birthDate || null,
    notifications_enabled: form.notificationsEnabled
  }).eq('id', auth.profile.id)
  if (error) saveStatus.value = 'Não foi possível salvar as alterações.'
  else {
    auth.profile.name = form.name.trim()
    saveStatus.value = 'Perfil atualizado com sucesso.'
  }
  savePending.value = false
}

async function requestDeletion() {
  if (!confirmDeletion.value || !auth.profile) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    requestStatus.value = 'Supabase não configurado; nenhuma solicitação foi enviada.'
    return
  }
  const { error } = await $supabase.from('account_deletion_requests').insert({ user_id: auth.profile.id, confirmed_at: new Date().toISOString() })
  requestStatus.value = error ? error.message : 'Solicitação registrada para análise administrativa.'
}

onMounted(async () => {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return
  const { data } = await $supabase.from('profiles').select('full_name, email, phone, sex, birth_date, avatar_path, notifications_enabled').eq('id', auth.profile.id).maybeSingle()
  if (data) {
    form.name = data.full_name || ''
    form.email = data.email || ''
    form.phone = data.phone || ''
    form.sex = data.sex || ''
    form.birthDate = data.birth_date || ''
    form.notificationsEnabled = data.notifications_enabled
    avatarPath.value = data.avatar_path || null
    if (avatarPath.value) await loadAvatar(avatarPath.value)
  }
})
</script>

<template>
  <div>
    <PageIntro
      title="Perfil"
      description="Seus dados pessoais. A idade é sempre derivada da data de nascimento."
      icon="i-lucide-user-round"
    /><div class="space-y-5">
      <UCard class="max-w-2xl">
        <div class="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 text-xl font-semibold text-primary">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              :alt="`Foto de perfil de ${auth.profile?.name || 'membro'}`"
              class="size-full object-cover"
            >
            <span v-else>{{ avatarInitials }}</span>
          </div>
          <div class="min-w-0">
            <h2 class="font-semibold">
              Foto de perfil
            </h2>
            <p class="mt-1 text-sm text-muted">
              Use uma imagem JPG, PNG ou WebP de até 5 MB.
            </p>
            <input
              ref="avatarInput"
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="handleAvatarSelection"
            >
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                :loading="avatarPending"
                :label="avatarPath ? 'Atualizar foto' : 'Adicionar foto'"
                icon="i-lucide-image-up"
                @click="openAvatarSelector"
              />
              <UButton
                v-if="avatarPath"
                :loading="avatarPending"
                color="error"
                variant="outline"
                label="Excluir foto"
                icon="i-lucide-trash-2"
                @click="removeAvatar"
              />
            </div>
            <UAlert
              v-if="avatarStatus"
              class="mt-3"
              color="neutral"
              variant="subtle"
              :description="avatarStatus"
            />
          </div>
        </div>
      </UCard>
      <UCard class="max-w-2xl">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nome">
            <UInput
              v-model="form.name"
              class="w-full"
            />
          </UFormField><UFormField label="E-mail">
            <UInput
              v-model="form.email"
              type="email"
              readonly
              class="w-full"
            />
          </UFormField><UFormField label="Telefone">
            <UInput
              v-model="form.phone"
              type="tel"
              class="w-full"
            />
          </UFormField><UFormField label="Sexo">
            <USelect
              v-model="form.sex"
              :items="sexItems"
              class="w-full"
            />
          </UFormField><UFormField label="Data de nascimento">
            <AppDatePicker
              v-model="form.birthDate"
              :max="new Date().toISOString().slice(0, 10)"
            />
          </UFormField>
        </div>
        <div class="mt-5 rounded-xl border border-default bg-elevated/40 p-4">
          <USwitch
            v-model="form.notificationsEnabled"
            label="Receber notificações"
            description="Escolha se deseja receber novos avisos e lembretes da comunidade neste perfil."
            checked-icon="i-lucide-bell"
            unchecked-icon="i-lucide-bell-off"
          />
          <p class="mt-3 text-xs leading-5 text-muted">
            Esta preferência vale para novos avisos internos. Notificações já recebidas continuam disponíveis na sua caixa de entrada.
          </p>
        </div><template #footer>
          <UButton
            :loading="savePending"
            label="Salvar alterações"
            @click="saveProfile"
          />
          <UAlert
            v-if="saveStatus"
            class="mt-3"
            color="neutral"
            variant="subtle"
            :description="saveStatus"
          />
        </template>
      </UCard><UCard class="max-w-2xl border-error/30">
        <h2 class="font-semibold text-error">
          Exclusão da conta
        </h2><p class="mt-2 text-sm text-muted">
          A solicitação abre uma análise administrativa. Nenhum usuário ou dado é apagado automaticamente.
        </p><UCheckbox
          v-model="confirmDeletion"
          class="mt-4"
          label="Confirmo que desejo solicitar a exclusão da minha conta"
        /><UButton
          class="mt-4"
          color="error"
          variant="outline"
          :disabled="!confirmDeletion"
          label="Solicitar exclusão da conta"
          @click="requestDeletion"
        /><UAlert
          v-if="requestStatus"
          class="mt-4"
          color="neutral"
          variant="subtle"
          :description="requestStatus"
        />
      </UCard>
    </div>
  </div>
</template>
