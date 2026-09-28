<script setup lang="ts">
import type { SystemRole } from '~/types/domain'

definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Pessoas e permissões' })

type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'invited'

interface ProfileRow {
  id: string
  full_name: string
  email: string
  phone: string | null
  avatar_path: string | null
  sex: 'female' | 'male' | 'not_informed' | null
  birth_date: string | null
  created_at: string
  updated_at: string
}

interface MembershipRow {
  community_id: string
  user_id: string
  status: MembershipStatus
  created_at: string
}

interface PendingRequest {
  communityId: string
  userId: string
  memberName: string
  memberEmail: string
  communityName: string
  createdAt: string
}

interface RoleUpdateError {
  data?: { statusMessage?: string }
  message?: string
}

const auth = useAuthStore()
const route = useRoute()
const loading = ref(true)
const savingRequest = ref('')
const savingRole = ref('')
const loadError = ref('')
const feedback = ref('')
const search = ref('')
const roleFilter = ref('all')
const phoneFilter = ref('all')
const sortOrder = ref('newest')
const pageSize = ref(10)
const currentPage = ref(1)
const expandedMemberId = ref<string | null>(null)
const detailsOpen = ref(false)
const selectedMemberId = ref<string | null>(null)
const members = ref<ProfileRow[]>([])
const roleRows = ref<Array<{ user_id: string, role: SystemRole }>>([])
const pendingRequests = ref<PendingRequest[]>([])
const canManageRoles = computed(() => auth.profile?.roles.includes('administrator') ?? false)

const roleLabels: Record<SystemRole, string> = {
  administrator: 'Administrador',
  pastor: 'Pastor',
  cashier: 'Caixa e estoque',
  counter: 'Balcão',
  teacher: 'Professor(a) infantil',
  member: 'Membro'
}
const sexLabels = {
  female: 'Feminino',
  male: 'Masculino',
  not_informed: 'Não informado'
}

const roleFilterItems = [
  { label: 'Todos os papéis', value: 'all' },
  { label: 'Sem função adicional', value: 'member' },
  { label: 'Administradores', value: 'administrator' },
  { label: 'Pastores', value: 'pastor' },
  { label: 'Caixa e estoque', value: 'cashier' },
  { label: 'Balcão', value: 'counter' },
  { label: 'Professores', value: 'teacher' }
]
const phoneFilterItems = [
  { label: 'Todos os contatos', value: 'all' },
  { label: 'Com telefone', value: 'with-phone' },
  { label: 'Sem telefone', value: 'without-phone' }
]
const sortItems = [
  { label: 'Mais recentes', value: 'newest' },
  { label: 'Mais antigos', value: 'oldest' },
  { label: 'Nome A–Z', value: 'name-asc' },
  { label: 'Nome Z–A', value: 'name-desc' }
]
const pageSizeItems = [10, 25, 50, 100]

const memberRoles = computed(() => {
  const rolesByMember = new Map<string, SystemRole[]>()
  for (const row of roleRows.value) {
    rolesByMember.set(row.user_id, [...(rolesByMember.get(row.user_id) || []), row.role])
  }
  return rolesByMember
})
const selectedMember = computed(() => members.value.find(member => member.id === selectedMemberId.value) || null)

const filteredMembers = computed(() => {
  const normalizedSearch = search.value.trim().toLocaleLowerCase('pt-BR')
  return members.value.filter((member) => {
    const matchesSearch = !normalizedSearch || [member.full_name, member.email, member.phone || '']
      .some(value => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
    const roles = memberRoles.value.get(member.id) || []
    const matchesRole = roleFilter.value === 'all'
      || (roleFilter.value === 'member'
        ? roles.every(role => role === 'member')
        : roles.includes(roleFilter.value as SystemRole))
    const matchesPhone = phoneFilter.value === 'all'
      || (phoneFilter.value === 'with-phone' ? Boolean(member.phone?.trim()) : !member.phone?.trim())
    return matchesSearch && matchesRole && matchesPhone
  }).sort((left, right) => {
    if (sortOrder.value === 'name-asc' || sortOrder.value === 'name-desc') {
      const comparison = left.full_name.localeCompare(right.full_name, 'pt-BR')
      return sortOrder.value === 'name-asc' ? comparison : -comparison
    }
    const comparison = left.created_at.localeCompare(right.created_at)
    return sortOrder.value === 'oldest' ? comparison : -comparison
  })
})

const totalPages = computed(() => Math.max(1, Math.ceil(filteredMembers.value.length / pageSize.value)))
const paginatedMembers = computed(() => filteredMembers.value.slice((currentPage.value - 1) * pageSize.value, currentPage.value * pageSize.value))
const firstVisibleMember = computed(() => filteredMembers.value.length ? (currentPage.value - 1) * pageSize.value + 1 : 0)
const lastVisibleMember = computed(() => Math.min(currentPage.value * pageSize.value, filteredMembers.value.length))

watch([search, roleFilter, phoneFilter, sortOrder, pageSize], () => {
  currentPage.value = 1
  expandedMemberId.value = null
})
watch(totalPages, (total) => {
  if (currentPage.value > total) currentPage.value = total
})
watch(currentPage, () => {
  expandedMemberId.value = null
})

const displayRequests = computed(() => route.query.view === 'pending' || pendingRequests.value.length > 0)

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'M'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

function formatBirthDate(value: string | null) {
  if (!value) return 'Não informada'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function openMemberDetails(member: ProfileRow) {
  selectedMemberId.value = member.id
  detailsOpen.value = true
}

function avatarUrl(path: string | null) {
  if (!path) return undefined
  const { $supabase } = useNuxtApp()
  return $supabase?.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

async function loadPeople() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    loadError.value = 'O serviço de dados não está configurado neste ambiente.'
    loading.value = false
    return
  }
  const supabase = $supabase

  loading.value = true
  loadError.value = ''
  feedback.value = ''
  async function loadAllProfiles() {
    const profiles: ProfileRow[] = []
    const batchSize = 500
    while (true) {
      const { data, error } = await supabase.from('profiles')
        .select('id, full_name, email, phone, avatar_path, sex, birth_date, created_at, updated_at')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(profiles.length, profiles.length + batchSize - 1)
      if (error) return { data: profiles, error }
      profiles.push(...(data || []) as ProfileRow[])
      if (!data || data.length < batchSize) return { data: profiles, error: null }
    }
  }

  const [profilesResult, rolesResult, membershipsResult, communitiesResult] = await Promise.all([
    loadAllProfiles(),
    $supabase.from('user_system_roles').select('user_id, role'),
    $supabase.from('community_memberships').select('community_id, user_id, status, created_at').eq('status', 'pending').order('created_at', { ascending: true }),
    $supabase.from('communities').select('id, name')
  ])

  if (profilesResult.error || rolesResult.error || membershipsResult.error || communitiesResult.error) {
    loadError.value = 'Não foi possível carregar todos os dados de gestão. Atualize a página e confirme as permissões da sessão.'
  }

  members.value = (profilesResult.data || []) as ProfileRow[]
  roleRows.value = (rolesResult.data || []) as Array<{ user_id: string, role: SystemRole }>
  const namesByUser = new Map(members.value.map(member => [member.id, member]))
  const namesByCommunity = new Map((communitiesResult.data || []).map(community => [community.id, community.name]))
  pendingRequests.value = ((membershipsResult.data || []) as MembershipRow[]).flatMap((request) => {
    const member = namesByUser.get(request.user_id)
    const communityName = namesByCommunity.get(request.community_id)
    if (!member || !communityName) return []
    return [{
      communityId: request.community_id,
      userId: request.user_id,
      memberName: member.full_name,
      memberEmail: member.email,
      communityName,
      createdAt: request.created_at
    }]
  })
  loading.value = false
}

async function reviewRequest(request: PendingRequest, status: 'approved' | 'rejected') {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return

  const requestKey = `${request.communityId}:${request.userId}`
  savingRequest.value = requestKey
  feedback.value = ''
  const { error } = await $supabase
    .from('community_memberships')
    .update({ status, reviewed_by: auth.profile.id, reviewed_at: new Date().toISOString() })
    .eq('community_id', request.communityId)
    .eq('user_id', request.userId)
    .eq('status', 'pending')

  savingRequest.value = ''
  if (error) {
    feedback.value = 'Não foi possível atualizar a solicitação. Tente novamente.'
    return
  }

  pendingRequests.value = pendingRequests.value.filter(item => `${item.communityId}:${item.userId}` !== requestKey)
  feedback.value = status === 'approved'
    ? `${request.memberName} agora participa de ${request.communityName}.`
    : `A solicitação de ${request.memberName} foi recusada.`
}

function hasMemberRole(memberId: string, role: SystemRole) {
  return memberRoles.value.get(memberId)?.includes(role) ?? false
}

async function updateSystemRole(member: ProfileRow, role: Exclude<SystemRole, 'member'>, enabled: boolean) {
  const { $supabase } = useNuxtApp()
  if (!$supabase) return

  const roleKey = `${member.id}:${role}`
  savingRole.value = roleKey
  feedback.value = ''
  try {
    const { data: { session } } = await $supabase.auth.getSession()
    if (!session?.access_token) throw new Error('A sessão administrativa expirou.')

    const result = await $fetch<{ roles: SystemRole[], sessionRefreshRequired: boolean }>('/api/admin/roles', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { userId: member.id, role, enabled }
    })

    roleRows.value = [
      ...roleRows.value.filter(item => item.user_id !== member.id),
      ...result.roles.map(currentRole => ({ user_id: member.id, role: currentRole }))
    ]
    feedback.value = enabled
      ? `${member.full_name} recebeu o papel de ${roleLabels[role]}. A pessoa precisará renovar a sessão para receber o novo acesso.`
      : `O papel de ${roleLabels[role]} foi removido de ${member.full_name}. As sessões existentes perderão o acesso ao renovar.`
  } catch (error: unknown) {
    const safeError = error as RoleUpdateError
    feedback.value = safeError.data?.statusMessage || safeError.message || 'Não foi possível alterar o papel do usuário.'
  } finally {
    savingRole.value = ''
  }
}

onMounted(loadPeople)
</script>

<template>
  <div>
    <BrandLoadingStatus
      v-if="savingRequest || savingRole"
      label="Atualizando permissões…"
    />
    <PageIntro
      title="Pessoas e permissões"
      description="Consulte os perfis cadastrados, os papéis atuais e analise solicitações de participação."
      icon="i-lucide-users-round"
    />

    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando pessoas…"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Permissões administrativas protegidas"
      description="Os papéis exibidos refletem o acesso atual. Alterações de permissões são processadas no servidor; a pessoa precisa renovar a sessão para receber o novo acesso."
    />

    <UAlert
      v-if="loadError || feedback"
      class="mt-5"
      :color="loadError ? 'error' : 'success'"
      variant="subtle"
      :title="loadError ? 'Não foi possível concluir o carregamento' : 'Solicitação atualizada'"
      :description="loadError || feedback"
    />

    <section
      v-if="displayRequests"
      class="mt-8"
      aria-labelledby="requests-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Fila de análise
          </p>
          <h2
            id="requests-title"
            class="mt-1 text-2xl font-bold"
          >
            Solicitações de participação
          </h2>
        </div>
        <UBadge
          color="primary"
          variant="subtle"
          :label="loading ? 'Carregando' : `${pendingRequests.length} pendente(s)`"
        />
      </div>

      <div
        v-if="loading"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <USkeleton
          v-for="index in 2"
          :key="index"
          class="h-40 rounded-xl"
        />
      </div>
      <div
        v-else-if="pendingRequests.length"
        class="mt-5 grid gap-4 lg:grid-cols-2"
      >
        <UCard
          v-for="request in pendingRequests"
          :key="`${request.communityId}:${request.userId}`"
        >
          <div class="flex items-start gap-3">
            <UAvatar
              :alt="request.memberName"
              :text="initials(request.memberName)"
              size="md"
            />
            <div class="min-w-0 flex-1">
              <h3 class="truncate font-semibold">
                {{ request.memberName }}
              </h3>
              <p class="truncate text-sm text-muted">
                {{ request.memberEmail }}
              </p>
              <p class="mt-3 text-sm">
                Solicitou entrada em <span class="font-semibold">{{ request.communityName }}</span>
              </p>
              <p class="mt-1 text-xs text-muted">
                Recebida em {{ formatDate(request.createdAt) }}
              </p>
            </div>
          </div>
          <template #footer>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="sm"
                icon="i-lucide-check"
                label="Aprovar"
                :loading="savingRequest === `${request.communityId}:${request.userId}`"
                @click="reviewRequest(request, 'approved')"
              />
              <UButton
                size="sm"
                color="neutral"
                variant="outline"
                icon="i-lucide-x"
                label="Recusar"
                :disabled="Boolean(savingRequest)"
                @click="reviewRequest(request, 'rejected')"
              />
            </div>
          </template>
        </UCard>
      </div>
      <UCard
        v-else
        class="mt-5"
      >
        <div class="flex items-center gap-3 text-muted">
          <UIcon
            name="i-lucide-circle-check-big"
            class="size-6 text-primary"
          />
          <p>Não há solicitações de participação pendentes.</p>
        </div>
      </UCard>
    </section>

    <section
      class="mt-8"
      aria-labelledby="members-title"
    >
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Diretório interno
          </p>
          <h2
            id="members-title"
            class="mt-1 text-2xl font-bold"
          >
            Membros cadastrados
          </h2>
        </div>
        <div class="flex w-full flex-wrap gap-2 sm:w-auto">
          <UInput
            v-model="search"
            class="min-w-60 flex-1 sm:w-80"
            icon="i-lucide-search"
            placeholder="Buscar por nome, e-mail ou telefone"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-refresh-cw"
            label="Atualizar"
            :loading="loading"
            @click="loadPeople"
          />
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <USelect
          v-model="roleFilter"
          :items="roleFilterItems"
          aria-label="Filtrar por papel"
          class="w-full"
        />
        <USelect
          v-model="phoneFilter"
          :items="phoneFilterItems"
          aria-label="Filtrar por telefone"
          class="w-full"
        />
        <USelect
          v-model="sortOrder"
          :items="sortItems"
          aria-label="Ordenar pessoas"
          class="w-full"
        />
        <div class="flex items-center gap-2">
          <label
            for="people-page-size"
            class="shrink-0 text-sm text-muted"
          >Por página</label>
          <USelect
            id="people-page-size"
            v-model="pageSize"
            :items="pageSizeItems"
            aria-label="Pessoas por página"
            class="w-full"
          />
        </div>
      </div>

      <div
        v-if="loading"
        class="mt-5 space-y-3"
      >
        <USkeleton
          v-for="index in 5"
          :key="index"
          class="h-24 rounded-xl"
        />
      </div>
      <div
        v-else-if="filteredMembers.length"
        class="mt-5 space-y-3"
      >
        <UCard
          v-for="member in paginatedMembers"
          :key="member.id"
        >
          <div class="flex flex-wrap items-center gap-4 lg:flex-nowrap">
            <UAvatar
              :src="avatarUrl(member.avatar_path)"
              :alt="member.full_name"
              :text="initials(member.full_name)"
              size="lg"
            />
            <div class="min-w-0 flex-1 basis-48">
              <h3 class="truncate font-semibold">
                {{ member.full_name }}
              </h3>
              <p class="truncate text-sm text-muted">
                {{ member.email }}
              </p>
              <p
                v-if="member.phone"
                class="mt-1 text-sm text-muted"
              >
                {{ member.phone }}
              </p>
            </div>
            <div class="flex min-w-32 flex-1 flex-wrap gap-2 lg:max-w-sm">
              <UBadge
                v-for="role in memberRoles.get(member.id) || ['member']"
                :key="role"
                :color="role === 'administrator' ? 'primary' : role === 'pastor' ? 'secondary' : 'neutral'"
                variant="subtle"
                :label="roleLabels[role]"
              />
            </div>
            <p class="text-xs text-muted lg:whitespace-nowrap">
              Cadastro em {{ formatDate(member.created_at) }}
            </p>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              icon="i-lucide-eye"
              label="Detalhes"
              :aria-label="`Ver detalhes de ${member.full_name}`"
              @click="openMemberDetails(member)"
            />
            <UButton
              v-if="canManageRoles"
              size="sm"
              color="neutral"
              variant="outline"
              :icon="expandedMemberId === member.id ? 'i-lucide-chevron-up' : 'i-lucide-settings-2'"
              :label="expandedMemberId === member.id ? 'Fechar' : 'Permissões'"
              :aria-expanded="expandedMemberId === member.id"
              :aria-controls="`member-roles-${member.id}`"
              @click="expandedMemberId = expandedMemberId === member.id ? null : member.id"
            />
          </div>

          <div
            v-if="canManageRoles && expandedMemberId === member.id"
            :id="`member-roles-${member.id}`"
            class="mt-4 border-t border-default pt-4"
          >
            <p class="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Gerenciar permissões
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="xs"
                color="neutral"
                :variant="hasMemberRole(member.id, 'pastor') ? 'solid' : 'outline'"
                :label="hasMemberRole(member.id, 'pastor') ? 'Remover pastor' : 'Tornar pastor'"
                :loading="savingRole === `${member.id}:pastor`"
                :disabled="Boolean(savingRole) || member.id === auth.profile?.id"
                @click="updateSystemRole(member, 'pastor', !hasMemberRole(member.id, 'pastor'))"
              />
              <UButton
                size="xs"
                :variant="hasMemberRole(member.id, 'administrator') ? 'solid' : 'outline'"
                :label="hasMemberRole(member.id, 'administrator') ? 'Remover admin' : 'Tornar admin'"
                :loading="savingRole === `${member.id}:administrator`"
                :disabled="Boolean(savingRole) || member.id === auth.profile?.id"
                @click="updateSystemRole(member, 'administrator', !hasMemberRole(member.id, 'administrator'))"
              />
              <UButton
                size="xs"
                color="neutral"
                :variant="hasMemberRole(member.id, 'cashier') ? 'solid' : 'outline'"
                :label="hasMemberRole(member.id, 'cashier') ? 'Remover caixa' : 'Tornar caixa'"
                :loading="savingRole === `${member.id}:cashier`"
                :disabled="Boolean(savingRole) || member.id === auth.profile?.id"
                @click="updateSystemRole(member, 'cashier', !hasMemberRole(member.id, 'cashier'))"
              />
              <UButton
                size="xs"
                color="neutral"
                :variant="hasMemberRole(member.id, 'counter') ? 'solid' : 'outline'"
                :label="hasMemberRole(member.id, 'counter') ? 'Remover balcão' : 'Tornar balcão'"
                :loading="savingRole === `${member.id}:counter`"
                :disabled="Boolean(savingRole) || member.id === auth.profile?.id"
                @click="updateSystemRole(member, 'counter', !hasMemberRole(member.id, 'counter'))"
              />
              <UButton
                size="xs"
                color="neutral"
                :variant="hasMemberRole(member.id, 'teacher') ? 'solid' : 'outline'"
                :label="hasMemberRole(member.id, 'teacher') ? 'Remover professor(a)' : 'Tornar professor(a)'"
                :loading="savingRole === `${member.id}:teacher`"
                :disabled="Boolean(savingRole) || member.id === auth.profile?.id"
                @click="updateSystemRole(member, 'teacher', !hasMemberRole(member.id, 'teacher'))"
              />
            </div>
          </div>
        </UCard>
      </div>
      <UCard
        v-else
        class="mt-5"
      >
        <p class="text-sm text-muted">
          Nenhum membro foi encontrado com os filtros selecionados.
        </p>
      </UCard>
      <div
        v-if="!loading && filteredMembers.length"
        class="mt-5 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-muted">
          Mostrando {{ firstVisibleMember }}–{{ lastVisibleMember }} de {{ filteredMembers.length }} {{ filteredMembers.length === 1 ? 'pessoa' : 'pessoas' }}
          <span v-if="filteredMembers.length !== members.length">({{ members.length }} no total)</span>
        </p>
        <UPagination
          v-if="totalPages > 1"
          v-model:page="currentPage"
          :total="filteredMembers.length"
          :items-per-page="pageSize"
          :sibling-count="0"
          class="w-full justify-center sm:hidden"
          aria-label="Páginas de pessoas"
        />
        <UPagination
          v-if="totalPages > 1"
          v-model:page="currentPage"
          :total="filteredMembers.length"
          :items-per-page="pageSize"
          :sibling-count="1"
          class="hidden sm:flex"
          show-edges
          aria-label="Páginas de pessoas"
        />
      </div>
    </section>

    <UModal
      v-model:open="detailsOpen"
      :title="selectedMember?.full_name || 'Detalhes da pessoa'"
      description="Informações do cadastro e permissões atuais."
      :ui="{ content: 'sm:max-w-xl' }"
    >
      <template #body>
        <div
          v-if="selectedMember"
          class="space-y-6"
        >
          <div class="flex items-center gap-4">
            <UAvatar
              :src="avatarUrl(selectedMember.avatar_path)"
              :alt="selectedMember.full_name"
              :text="initials(selectedMember.full_name)"
              size="2xl"
            />
            <div class="min-w-0">
              <p class="break-words text-lg font-semibold">
                {{ selectedMember.full_name }}
              </p>
              <p class="break-all text-sm text-muted">
                {{ selectedMember.email }}
              </p>
            </div>
          </div>

          <dl class="grid gap-4 rounded-xl border border-default p-4 sm:grid-cols-2">
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                Telefone
              </dt>
              <dd class="mt-1 break-words text-sm">
                {{ selectedMember.phone || 'Não informado' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                Sexo
              </dt>
              <dd class="mt-1 text-sm">
                {{ selectedMember.sex ? sexLabels[selectedMember.sex] : 'Não informado' }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                Data de nascimento
              </dt>
              <dd class="mt-1 text-sm">
                {{ formatBirthDate(selectedMember.birth_date) }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                Cadastro
              </dt>
              <dd class="mt-1 text-sm">
                {{ formatDate(selectedMember.created_at) }}
              </dd>
            </div>
            <div class="sm:col-span-2">
              <dt class="text-xs font-semibold uppercase tracking-wide text-muted">
                Última atualização
              </dt>
              <dd class="mt-1 text-sm">
                {{ formatDate(selectedMember.updated_at) }}
              </dd>
            </div>
          </dl>

          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-muted">
              Papéis atuais
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge
                v-for="role in memberRoles.get(selectedMember.id) || ['member']"
                :key="role"
                :color="role === 'administrator' ? 'primary' : role === 'pastor' ? 'secondary' : 'neutral'"
                variant="subtle"
                :label="roleLabels[role]"
              />
            </div>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end">
          <UButton
            color="neutral"
            variant="outline"
            label="Fechar"
            @click="detailsOpen = false"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
