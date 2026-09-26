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
const familyEditorOpen = ref(false)
const familyDeleteOpen = ref(false)
const familyMemberToDelete = ref<FamilyMember | null>(null)
const birthdayPeriod = ref<BirthdayPeriod>('today')
const familyForm = reactive({ id: '', name: '', relationship: '', birthDate: '' })
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
}

function openFamilyEditor(member?: FamilyMember) {
  familyStatus.value = ''
  if (member) {
    familyForm.id = member.id
    familyForm.name = member.full_name
    familyForm.relationship = member.relationship
    familyForm.birthDate = member.birth_date
  } else {
    resetFamilyForm()
  }
  familyEditorOpen.value = true
}

async function loadFamilyMembers() {
  if (!auth.profile) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    familyStatus.value = 'Não foi possível carregar a família porque o serviço de dados está indisponível.'
    familyLoading.value = false
    return
  }
  familyLoading.value = true
  const { data, error } = await $supabase
    .from('family_members')
    .select('id, full_name, relationship, birth_date')
    .order('birth_date')
  familyMembers.value = (data || []) as FamilyMember[]
  if (error) familyStatus.value = 'Não foi possível carregar seus familiares.'
  familyLoading.value = false
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
  await loadFamilyMembers()
})
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="savePending || avatarPending || familySaving"
      label="Salvando perfil…"
    />
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
          <div class="mt-4">
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
            <span class="text-xs text-muted">{{ familyMembers.length }} cadastrado{{ familyMembers.length === 1 ? '' : 's' }}</span>
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
            v-else
            class="mt-3 text-sm text-muted"
          >
            Nenhum familiar cadastrado ainda.
          </p>
        </div>
        <UAlert
          v-if="familyStatus"
          class="mt-4"
          color="neutral"
          variant="subtle"
          :description="familyStatus"
        />
      </UCard>

      <UCard class="max-w-2xl border-error/30">
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
