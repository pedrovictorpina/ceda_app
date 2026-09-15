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
  created_at: string
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

const auth = useAuthStore()
const route = useRoute()
const loading = ref(true)
const savingRequest = ref('')
const loadError = ref('')
const feedback = ref('')
const search = ref('')
const members = ref<ProfileRow[]>([])
const roleRows = ref<Array<{ user_id: string, role: SystemRole }>>([])
const pendingRequests = ref<PendingRequest[]>([])

const roleLabels: Record<SystemRole, string> = {
  administrator: 'Administrador',
  pastor: 'Pastor',
  member: 'Membro'
}

const memberRoles = computed(() => {
  const rolesByMember = new Map<string, SystemRole[]>()
  for (const row of roleRows.value) {
    rolesByMember.set(row.user_id, [...(rolesByMember.get(row.user_id) || []), row.role])
  }
  return rolesByMember
})

const filteredMembers = computed(() => {
  const normalizedSearch = search.value.trim().toLocaleLowerCase('pt-BR')
  if (!normalizedSearch) return members.value
  return members.value.filter(member => [member.full_name, member.email, member.phone || '']
    .some(value => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch)))
})

const displayRequests = computed(() => route.query.view === 'pending' || pendingRequests.value.length > 0)

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'M'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
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

  loading.value = true
  loadError.value = ''
  feedback.value = ''
  const [profilesResult, rolesResult, membershipsResult, communitiesResult] = await Promise.all([
    $supabase.from('profiles').select('id, full_name, email, phone, avatar_path, created_at').order('created_at', { ascending: false }).limit(250),
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

onMounted(loadPeople)
</script>

<template>
  <div>
    <PageIntro
      title="Pessoas e permissões"
      description="Consulte os perfis cadastrados, os papéis atuais e analise solicitações de participação."
      icon="i-lucide-users-round"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Permissões administrativas protegidas"
      description="Os papéis exibidos refletem o acesso atual. A criação ou revogação de papéis será ligada a uma operação administrativa de servidor, para nunca expor credenciais privilegiadas no navegador."
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

      <div
        v-if="loading"
        class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <USkeleton
          v-for="index in 6"
          :key="index"
          class="h-48 rounded-xl"
        />
      </div>
      <div
        v-else-if="filteredMembers.length"
        class="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        <UCard
          v-for="member in filteredMembers"
          :key="member.id"
        >
          <div class="flex items-start gap-3">
            <UAvatar
              :src="avatarUrl(member.avatar_path)"
              :alt="member.full_name"
              :text="initials(member.full_name)"
              size="lg"
            />
            <div class="min-w-0 flex-1">
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
          </div>

          <div class="mt-5">
            <p class="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
              Papéis atuais
            </p>
            <div class="mt-2 flex flex-wrap gap-2">
              <UBadge
                v-for="role in memberRoles.get(member.id) || ['member']"
                :key="role"
                :color="role === 'administrator' ? 'primary' : role === 'pastor' ? 'secondary' : 'neutral'"
                variant="subtle"
                :label="roleLabels[role]"
              />
            </div>
          </div>

          <template #footer>
            <p class="text-xs text-muted">
              Cadastro em {{ formatDate(member.created_at) }}
            </p>
          </template>
        </UCard>
      </div>
      <UCard
        v-else
        class="mt-5"
      >
        <p class="text-sm text-muted">
          Nenhum membro foi encontrado com esta busca.
        </p>
      </UCard>
    </section>
  </div>
</template>
