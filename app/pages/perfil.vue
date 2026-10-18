<script setup lang="ts">
import { buildRegistrationInvitationUrl, invitationDescription, type InvitationSource } from '~/utils/invitations'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Perfil' })
const auth = useAuthStore()
const { form, birthdayOptInAvailable, loading: profileLoading, ready: profileReady, errorMessage: profileLoadError, status: saveStatus, saving: savePending, dirty: profileDirty, load: loadProfileDetails, save: saveProfile } = useProfileDetails()
const confirmDeletion = ref(false)
const requestStatus = ref('')
const deletionPending = ref(false)
const deletionSent = ref(false)
const avatarInput = useTemplateRef('avatarInput')
const avatarPath = ref<string | null>(null)
const avatarUrl = ref('')
const avatarStatus = ref('')
const avatarPending = ref(false)
type FamilyMember = {
  id: string
  full_name: string
  relationship: string
  birth_date: string
}

type BirthdayPeriod = 'today' | 'week' | 'month' | 'year'

const familyMembers = ref<FamilyMember[]>([])
const familyLoading = ref(true)
const familySaving = ref(false)
const familyStatus = ref('')
const familyLoadError = ref('')
const familyEditorOpen = ref(false)
const familyDeleteOpen = ref(false)
const familyMemberToDelete = ref<FamilyMember | null>(null)
const birthdayPeriod = ref<BirthdayPeriod>('today')
const inviteImageOpen = ref(false)
const familyInviteOpen = ref(false)
const inviteStatus = ref('')
const familyForm = reactive({ id: '', name: '', relationship: '', birthDate: '', showInvitation: true })
let familyLoadId = 0
const sexItems = [
  { label: 'Feminino', value: 'female' },
  { label: 'Masculino', value: 'male' },
  { label: 'Prefiro não informar', value: 'not_informed' }
]

const birthdayPeriodItems: Array<{ label: string, value: BirthdayPeriod }> = [
  { label: 'Hoje', value: 'today' },
  { label: 'Semana', value: 'week' },
  { label: 'Mês', value: 'month' },
  { label: 'Ano', value: 'year' }
]

const todayIso = new Date().toISOString().slice(0, 10)

function parseBirthDate(birthDate: string) {
  const [year, month, day] = birthDate.split('-').map(Number)
  if (year === undefined || month === undefined || day === undefined) return new Date(Number.NaN)
  return new Date(year, month - 1, day)
}

function calculateAge(birthDate: string) {
  const birth = parseBirthDate(birthDate)
  if (Number.isNaN(birth.valueOf())) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const birthdayHasNotArrived = now.getMonth() < birth.getMonth()
    || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (birthdayHasNotArrived) age -= 1
  return age >= 0 ? age : null
}

function formatBirthDate(birthDate: string) {
  if (!birthDate) return ''
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long' }).format(parseBirthDate(birthDate))
}

const profileAge = computed(() => form.birthDate ? calculateAge(form.birthDate) : null)
const birthdayPeople = computed(() => {
  const people = [...familyMembers.value]
  if (form.name.trim() && form.birthDate) {
    people.unshift({ id: 'profile', full_name: form.name.trim(), relationship: 'Você', birth_date: form.birthDate })
  }
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const inSevenDays = new Date(todayStart)
  inSevenDays.setDate(inSevenDays.getDate() + 6)

  const nextBirthday = (person: FamilyMember) => {
    const birth = parseBirthDate(person.birth_date)
    const candidate = new Date(today.getFullYear(), birth.getMonth(), birth.getDate())
    if (candidate < todayStart) candidate.setFullYear(candidate.getFullYear() + 1)
    return candidate
  }

  return people
    .filter((person) => {
      const birth = parseBirthDate(person.birth_date)
      if (Number.isNaN(birth.valueOf())) return false
      if (birthdayPeriod.value === 'today') return birth.getMonth() === today.getMonth() && birth.getDate() === today.getDate()
      if (birthdayPeriod.value === 'week') {
        const next = nextBirthday(person)
        return next >= todayStart && next <= inSevenDays
      }
      if (birthdayPeriod.value === 'month') return birth.getMonth() === today.getMonth()
      return true
    })
    .sort((a, b) => {
      if (birthdayPeriod.value === 'year' || birthdayPeriod.value === 'month') {
        const aDate = parseBirthDate(a.birth_date)
        const bDate = parseBirthDate(b.birth_date)
        return aDate.getMonth() - bDate.getMonth() || aDate.getDate() - bDate.getDate()
      }
      return nextBirthday(a).valueOf() - nextBirthday(b).valueOf()
    })
})

function resetFamilyForm() {
  familyForm.id = ''
  familyForm.name = ''
  familyForm.relationship = ''
  familyForm.birthDate = ''
  familyForm.showInvitation = true
}

function openFamilyEditor(member?: FamilyMember) {
  familyStatus.value = ''
  if (member) {
    familyForm.id = member.id
    familyForm.name = member.full_name
    familyForm.relationship = member.relationship
    familyForm.birthDate = member.birth_date
    familyForm.showInvitation = false
  } else {
    resetFamilyForm()
  }
  familyEditorOpen.value = true
}

async function loadFamilyMembers() {
  const userId = auth.profile?.id
  const current = ++familyLoadId
  familyLoading.value = true
  familyLoadError.value = ''
  try {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !userId) throw new Error('session')
    const { data, error } = await $supabase.from('family_members').select('id, full_name, relationship, birth_date').eq('owner_id', userId).order('birth_date')
    if (error) throw error
    if (current === familyLoadId && auth.profile?.id === userId) familyMembers.value = (data || []) as FamilyMember[]
  } catch {
    if (current === familyLoadId) familyLoadError.value = 'Não foi possível atualizar seus familiares. A lista já carregada foi mantida; tente novamente.'
  } finally { if (current === familyLoadId) familyLoading.value = false }
}

async function saveFamilyMember() {
  if (!auth.profile || !familyForm.name.trim() || !familyForm.relationship.trim() || !familyForm.birthDate) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    familyStatus.value = 'Não foi possível salvar porque o serviço de dados está indisponível.'
    return
  }
  familySaving.value = true
  familyStatus.value = ''
  const payload = {
    full_name: familyForm.name.trim(),
    relationship: familyForm.relationship.trim(),
    birth_date: familyForm.birthDate
  }
  const isNewFamilyMember = !familyForm.id
  const showInvitation = isNewFamilyMember && familyForm.showInvitation
  const { error } = familyForm.id
    ? await $supabase.from('family_members').update(payload).eq('id', familyForm.id)
    : await $supabase.from('family_members').insert({ ...payload, owner_id: auth.profile.id })
  familySaving.value = false
  if (error) {
    familyStatus.value = 'Não foi possível salvar este familiar. Tente novamente.'
    return
  }
  familyEditorOpen.value = false
  familyStatus.value = familyForm.id ? 'Familiar atualizado.' : 'Familiar cadastrado.'
  resetFamilyForm()
  await loadFamilyMembers()
  if (showInvitation) familyInviteOpen.value = true
}

function invitationUrl(source: InvitationSource = 'general') {
  return buildRegistrationInvitationUrl(source)
}

const generalInvitationUrl = computed(() => invitationUrl())
const familyInvitationUrl = computed(() => invitationUrl('family'))

async function copyInvitation(source: InvitationSource = 'general') {
  try {
    await navigator.clipboard.writeText(invitationUrl(source))
    inviteStatus.value = source === 'family' ? 'Link de convite para a família copiado.' : 'Link de convite copiado.'
  } catch {
    inviteStatus.value = 'Não foi possível copiar o link neste aparelho.'
  }
}

async function shareInvitation(source: InvitationSource = 'general') {
  const url = invitationUrl(source)
  const description = invitationDescription(source)
  if (!navigator.share) return copyInvitation(source)
  try {
    await navigator.share({ title: 'Convite CEDA', text: description, url })
    inviteStatus.value = 'Convite pronto para compartilhar.'
  } catch {
    // Fechar a folha de compartilhamento não requer uma mensagem de erro.
  }
}

function requestFamilyDeletion(member: FamilyMember) {
  familyMemberToDelete.value = member
  familyDeleteOpen.value = true
}

async function deleteFamilyMember() {
  const member = familyMemberToDelete.value
  if (!member) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  familySaving.value = true
  const { error } = await $supabase.from('family_members').delete().eq('id', member.id)
  familySaving.value = false
  familyDeleteOpen.value = false
  familyMemberToDelete.value = null
  familyStatus.value = error ? 'Não foi possível excluir este familiar.' : 'Familiar removido.'
  if (!error) await loadFamilyMembers()
}

const avatarInitials = computed(() => (auth.profile?.name || 'Membro')
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join(''))

function openAvatarSelector() {
  avatarInput.value?.inputRef?.click()
}

async function loadAvatar(path: string) {
  const userId = auth.profile?.id
  const { $supabase } = useNuxtApp()
  if (!$supabase) return
  const { data, error } = await $supabase.storage.from('avatars').createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl || auth.profile?.id !== userId || avatarPath.value !== path) return
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

async function requestDeletion() {
  if (!confirmDeletion.value || !auth.profile || deletionPending.value || deletionSent.value) return
  const userId = auth.profile.id
  deletionPending.value = true
  requestStatus.value = ''
  try {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('session')
    const { data, error } = await $supabase.from('account_deletion_requests').insert({ user_id: userId, confirmed_at: new Date().toISOString() }).select('id').single()
    if (error || !data?.id) throw error || new Error('not-created')
    if (auth.profile?.id !== userId) return
    deletionSent.value = true
    confirmDeletion.value = false
    requestStatus.value = 'Solicitação registrada para análise administrativa. Sua conta e seus dados continuam disponíveis enquanto o pedido é analisado.'
  } catch {
    if (auth.profile?.id === userId) requestStatus.value = 'Não foi possível confirmar o envio da solicitação. Confira a conexão e procure os canais de Contato para acompanhar o pedido.'
  } finally { deletionPending.value = false }
}

async function loadProfile() {
  const data = await loadProfileDetails()
  if (data) {
    avatarPath.value = data.avatar_path
    if (data.avatar_path) {
      try {
        await loadAvatar(data.avatar_path)
      } catch {
        avatarStatus.value = 'Seu perfil foi carregado, mas não foi possível abrir a foto. Tente atualizar a página.'
      }
    }
  }
}
watch(() => auth.profile?.id, () => {
  ++familyLoadId
  familyMembers.value = []
  familyLoading.value = false
  familyStatus.value = ''
  familyLoadError.value = 'Seu acesso mudou. Atualize a lista para consultar os familiares desta conta.'
  familyEditorOpen.value = false
  familyDeleteOpen.value = false
  familyMemberToDelete.value = null
  resetFamilyForm()
  avatarPath.value = null
  avatarUrl.value = ''
  avatarStatus.value = ''
  confirmDeletion.value = false
  deletionSent.value = false
  requestStatus.value = ''
}, { flush: 'sync' })
onMounted(async () => {
  await loadProfile()
  await loadFamilyMembers()
})
</script>

<template>
  <div>
    <AppUnsavedChanges :dirty="profileDirty" />
    <BrandLoadingStatus
      v-if="savePending || avatarPending || familySaving"
      label="Salvando perfil…"
    />
    <PageIntro
      title="Perfil"
      description="Atualize seus dados e escolha o que compartilhar com a comunidade."
      icon="i-lucide-user-round"
    /><div class="space-y-5">
      <UAlert
        v-if="profileLoadError"
        color="error"
        :description="profileLoadError"
        :actions="[{ label: 'Tentar novamente', onClick: loadProfile }]"
        class="max-w-2xl"
      />
      <BrandLoadingStatus
        v-if="profileLoading"
        label="Carregando seu perfil…"
      />
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
            <UInput
              ref="avatarInput"
              class="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              @change="handleAvatarSelection"
            />
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
        <fieldset
          :disabled="profileLoading || !profileReady || savePending"
          class="contents"
        >
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
          <p
            v-if="profileAge !== null"
            class="mt-3 text-sm text-muted"
          >
            Sua idade: <span class="font-medium text-default">{{ profileAge }} {{ profileAge === 1 ? 'ano' : 'anos' }}</span>
          </p>
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
          </div>
          <BirthdayGreetingsToggle
            v-model="form.birthdayGreetingsOptIn"
            :has-birth-date="Boolean(form.birthDate)"
            :available="birthdayOptInAvailable"
          />
        </fieldset>
        <template #footer>
          <UButton
            :loading="savePending"
            :disabled="profileLoading || !profileReady"
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
      </UCard>

      <UCard class="max-w-2xl">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="font-semibold">
                Minha família
              </h2>
              <p class="mt-1 text-sm text-muted">
                Cadastre parentes para acompanhar os aniversariantes da sua casa.
              </p>
            </div>
            <UButton
              label="Adicionar familiar"
              icon="i-lucide-user-round-plus"
              @click="openFamilyEditor()"
            />
          </div>
        </template>

        <div class="rounded-xl border border-default bg-elevated/40 p-4">
          <div class="flex flex-wrap gap-2">
            <UButton
              v-for="item in birthdayPeriodItems"
              :key="item.value"
              size="sm"
              :variant="birthdayPeriod === item.value ? 'solid' : 'outline'"
              :label="item.label"
              @click="birthdayPeriod = item.value"
            />
          </div>
          <div
            v-if="!familyLoading && !familyLoadError"
            class="mt-4"
          >
            <p class="text-sm font-medium">
              Aniversariantes: {{ birthdayPeriodItems.find(item => item.value === birthdayPeriod)?.label.toLowerCase() }}
            </p>
            <div
              v-if="birthdayPeople.length"
              class="mt-3 divide-y divide-default rounded-lg border border-default bg-default"
            >
              <div
                v-for="person in birthdayPeople"
                :key="person.id"
                class="flex items-center justify-between gap-3 px-3 py-2.5"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-medium">
                    {{ person.full_name }}
                  </p>
                  <p class="text-xs text-muted">
                    {{ person.relationship }} · {{ formatBirthDate(person.birth_date) }}
                  </p>
                </div>
                <span class="shrink-0 text-xs text-muted">{{ calculateAge(person.birth_date) }} anos</span>
              </div>
            </div>
            <p
              v-else
              class="mt-3 text-sm text-muted"
            >
              Nenhum aniversariante neste período.
            </p>
          </div>
        </div>

        <div class="mt-5">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-sm font-semibold">
              Familiares cadastrados
            </h3>
            <span
              v-if="!familyLoading && !familyLoadError"
              class="text-xs text-muted"
            >{{ familyMembers.length }} cadastrado{{ familyMembers.length === 1 ? '' : 's' }}</span>
          </div>
          <div
            v-if="familyLoading"
            class="mt-3 text-sm text-muted"
          >
            <BrandLoader
              size="sm"
              label="Carregando familiares…"
            />
          </div>
          <div
            v-else-if="familyMembers.length"
            class="mt-3 divide-y divide-default rounded-xl border border-default"
          >
            <div
              v-for="member in familyMembers"
              :key="member.id"
              class="flex items-center justify-between gap-3 p-3"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">
                  {{ member.full_name }}
                </p>
                <p class="text-xs text-muted">
                  {{ member.relationship }} · {{ formatBirthDate(member.birth_date) }} · {{ calculateAge(member.birth_date) }} anos
                </p>
              </div>
              <div class="flex shrink-0 gap-1">
                <UButton
                  color="primary"
                  variant="ghost"
                  icon="i-lucide-link"
                  :aria-label="`Copiar convite para ${member.full_name}`"
                  @click="copyInvitation('family')"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  icon="i-lucide-pencil"
                  :aria-label="`Editar ${member.full_name}`"
                  @click="openFamilyEditor(member)"
                />
                <UButton
                  color="error"
                  variant="ghost"
                  icon="i-lucide-trash-2"
                  :aria-label="`Excluir ${member.full_name}`"
                  @click="requestFamilyDeletion(member)"
                />
              </div>
            </div>
          </div>
          <p
            v-else-if="!familyLoadError"
            class="mt-3 text-sm text-muted"
          >
            Nenhum familiar cadastrado ainda.
          </p>
        </div>
        <UAlert
          v-if="familyLoadError"
          class="mt-4"
          color="error"
          :description="familyLoadError"
          :actions="[{ label: 'Tentar novamente', onClick: loadFamilyMembers }]"
        />
        <UAlert
          v-if="familyStatus"
          class="mt-4"
          color="neutral"
          variant="subtle"
          :description="familyStatus"
        />
      </UCard>

      <UCard class="max-w-2xl">
        <template #header>
          <div>
            <h2 class="font-semibold">
              Convite para cadastro
            </h2>
            <p class="mt-1 text-sm text-muted">
              Compartilhe este link para que novas pessoas criem a própria conta na CEDA.
            </p>
          </div>
        </template>
        <UInput
          :model-value="generalInvitationUrl"
          readonly
          aria-label="Link fixo de convite para cadastro"
          class="w-full"
        />
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-copy"
            label="Copiar link"
            @click="copyInvitation()"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-share-2"
            label="Compartilhar link"
            @click="shareInvitation()"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-qr-code"
            label="Gerar imagem com QR Code"
            @click="inviteImageOpen = true"
          />
        </div>
        <p class="mt-4 text-xs leading-5 text-muted">
          Todo convite cria uma conta de membro. Papéis como administrador, pastor, caixa, balcão e professor só podem ser concedidos por um administrador em Pessoas e permissões.
        </p>
        <UAlert
          v-if="inviteStatus"
          class="mt-4"
          color="neutral"
          variant="subtle"
          :description="inviteStatus"
        />
      </UCard>

      <UCard class="max-w-2xl border-error/30">
        <h2 class="font-semibold text-error">
          Exclusão da conta
        </h2><p class="mt-2 text-sm text-muted">
          A solicitação abre uma análise administrativa. Nenhum usuário ou dado é apagado automaticamente.
        </p><UCheckbox
          v-model="confirmDeletion"
          :disabled="deletionPending || deletionSent"
          class="mt-4"
          label="Confirmo que desejo solicitar a exclusão da minha conta"
        /><UButton
          class="mt-4"
          color="error"
          variant="outline"
          :disabled="!confirmDeletion || deletionSent"
          :loading="deletionPending"
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

    <p class="mt-8 text-center text-sm text-muted">
      Saiba como cuidamos dos seus dados na
      <ULink
        to="/privacidade"
        class="focus-ring rounded font-medium text-primary underline-offset-4 hover:underline"
      >Política de Privacidade</ULink>.
    </p>
    <UModal v-model:open="familyEditorOpen">
      <template #content>
        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold">
                {{ familyForm.id ? 'Editar familiar' : 'Cadastrar familiar' }}
              </h2>
              <p class="mt-1 text-sm text-muted">
                Esses dados são privados e visíveis somente neste perfil.
              </p>
            </div>
          </template>
          <div class="space-y-4">
            <UFormField
              label="Nome completo"
              required
            >
              <UInput
                v-model="familyForm.name"
                class="w-full"
                autocomplete="name"
              />
            </UFormField>
            <UFormField
              label="Parentesco"
              required
            >
              <UInput
                v-model="familyForm.relationship"
                class="w-full"
                placeholder="Ex.: Filha, esposo, mãe"
              />
            </UFormField>
            <UFormField
              label="Data de nascimento"
              required
            >
              <AppDatePicker
                v-model="familyForm.birthDate"
                :max="todayIso"
              />
            </UFormField>
            <p
              v-if="familyForm.birthDate && calculateAge(familyForm.birthDate) !== null"
              class="text-sm text-muted"
            >
              Idade calculada: {{ calculateAge(familyForm.birthDate) }} anos.
            </p>
            <UCheckbox
              v-if="!familyForm.id"
              v-model="familyForm.showInvitation"
              label="Mostrar o link de convite depois de salvar"
              description="Você poderá copiar ou compartilhar o link para a pessoa completar o próprio cadastro."
            />
          </div>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                label="Cancelar"
                @click="familyEditorOpen = false"
              />
              <UButton
                :loading="familySaving"
                :disabled="!familyForm.name.trim() || !familyForm.relationship.trim() || !familyForm.birthDate"
                label="Salvar familiar"
                @click="saveFamilyMember"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>

    <UModal
      v-model:open="familyInviteOpen"
      title="Convite para familiar"
      description="Envie este link para a pessoa completar o cadastro dela na CEDA."
    >
      <template #body>
        <UInput
          :model-value="familyInvitationUrl"
          readonly
          aria-label="Link de convite para familiar"
          class="w-full"
        />
        <p class="mt-3 text-sm text-muted">
          O cadastro inicia como membro. Apenas um administrador pode conceder outros papéis.
        </p>
      </template>
      <template #footer>
        <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-share-2"
            label="Compartilhar"
            class="justify-center"
            @click="shareInvitation('family')"
          />
          <UButton
            icon="i-lucide-copy"
            label="Copiar link"
            class="justify-center"
            @click="copyInvitation('family')"
          />
        </div>
      </template>
    </UModal>

    <InviteImageExport
      v-model:open="inviteImageOpen"
      :invite-url="generalInvitationUrl"
    />

    <UModal v-model:open="familyDeleteOpen">
      <template #content>
        <UCard>
          <template #header>
            <h2 class="font-semibold text-error">
              Excluir familiar
            </h2>
          </template>
          <p class="text-sm text-muted">
            Deseja realmente excluir {{ familyMemberToDelete?.full_name }} da sua lista? Esta ação não pode ser desfeita.
          </p>
          <template #footer>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="outline"
                label="Cancelar"
                @click="familyDeleteOpen = false"
              />
              <UButton
                color="error"
                :loading="familySaving"
                label="Excluir familiar"
                @click="deleteFamilyMember"
              />
            </div>
          </template>
        </UCard>
      </template>
    </UModal>
  </div>
</template>
