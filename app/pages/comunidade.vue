<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Grupos e ministérios' })
type MembershipStatus = 'pending' | 'approved' | 'rejected' | 'invited'
interface Group { id: string, name: string, description: string | null, visibility: 'members' | 'private' }
const auth = useAuthStore()
const query = ref('')
const groups = ref<Group[]>([])
const memberships = ref<Record<string, MembershipStatus>>({})
const loading = ref(true)
const busyId = ref('')
const errorMessage = ref('')
const feedback = ref('')
let sessionVersion = 0
let loadVersion = 0
const current = (userId: string | undefined, version: number) => Boolean(userId) && auth.profile?.id === userId && sessionVersion === version
const filteredGroups = computed(() => groups.value.filter(group => `${group.name} ${group.description || ''}`.toLocaleLowerCase('pt-BR').includes(query.value.trim().toLocaleLowerCase('pt-BR'))))

async function loadGroups() {
  if (busyId.value) return
  const userId = auth.profile?.id
  const version = sessionVersion
  const request = ++loadVersion
  const valid = () => current(userId, version) && request === loadVersion
  loading.value = true
  errorMessage.value = ''
  try {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) throw new Error('session')
    const [groupResult, membershipResult, cellsResult] = await Promise.all([
      $supabase.from('communities').select('id, name, description, visibility').order('name'),
      $supabase.from('community_memberships').select('community_id, status').eq('user_id', userId!),
      $supabase.rpc('list_cell_directory')
    ])
    if (groupResult.error || membershipResult.error || cellsResult.error) throw new Error('load')
    if (!valid()) return
    const cellIds = new Set((cellsResult.data || []).map((cell: { cell_id: string }) => cell.cell_id))
    groups.value = (groupResult.data || []).filter(group => !cellIds.has(group.id)) as Group[]
    memberships.value = Object.fromEntries((membershipResult.data || []).map(item => [item.community_id, item.status]))
  } catch {
    if (valid()) errorMessage.value = 'Não foi possível carregar os grupos. Verifique a conexão e tente novamente.'
  } finally {
    if (valid()) loading.value = false
  }
}

async function requestGroup(group: Group, cancel = false) {
  if (busyId.value) return
  const userId = auth.profile?.id
  const version = sessionVersion
  loadVersion++
  loading.value = false
  busyId.value = group.id
  errorMessage.value = ''
  feedback.value = ''
  try {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile) throw new Error('session')
    if (cancel) {
      const { data, error } = await $supabase.from('community_memberships').delete()
        .eq('community_id', group.id).eq('user_id', userId!).eq('status', 'pending').select('community_id')
      if (error || !data?.length) throw new Error('changed')
      if (!current(userId, version)) return
      Reflect.deleteProperty(memberships.value, group.id)
      feedback.value = `Solicitação para ${group.name} cancelada.`
    } else {
      const { data, error } = await $supabase.from('community_memberships')
        .insert({ community_id: group.id, user_id: userId!, status: 'pending', role: 'member' }).select('status').single()
      if (error || !data) throw new Error('request')
      if (!current(userId, version)) return
      memberships.value[group.id] = data.status as MembershipStatus
      feedback.value = `Solicitação enviada para ${group.name}. Aguarde a análise da liderança; o resultado aparecerá nesta página.`
    }
  } catch {
    if (current(userId, version)) errorMessage.value = 'Não foi possível concluir a solicitação. Atualize a lista para conferir a situação antes de tentar novamente.'
  } finally {
    if (sessionVersion === version) busyId.value = ''
  }
}
watch(() => auth.profile?.id, (userId) => {
  sessionVersion++
  loadVersion++
  groups.value = []
  memberships.value = {}
  query.value = ''
  errorMessage.value = ''
  feedback.value = ''
  busyId.value = ''
  loading.value = false
  if (userId) void loadGroups()
}, { flush: 'sync' })
onMounted(loadGroups)
</script>

<template>
  <div>
    <PageIntro
      title="Grupos e ministérios"
      description="Encontre um lugar para participar e servir. A liderança analisa os pedidos de entrada; acompanhe a resposta aqui."
      icon="i-lucide-users"
    />
    <UAlert
      class="mb-5"
      color="neutral"
      title="Procurando um encontro nas casas?"
      description="As células têm encontros, líderes e pedidos de visita em uma área própria."
      :actions="[{ label: 'Encontrar uma célula', to: '/celulas', variant: 'soft' }]"
    />
    <div class="mb-5 flex flex-wrap gap-3">
      <UInput
        v-model="query"
        icon="i-lucide-search"
        placeholder="Buscar por nome ou atividade"
        aria-label="Buscar grupos e ministérios"
        class="w-full sm:max-w-lg"
      />
      <UButton
        color="neutral"
        variant="outline"
        label="Atualizar"
        icon="i-lucide-refresh-cw"
        :loading="loading"
        :disabled="Boolean(busyId)"
        @click="loadGroups"
      />
    </div>
    <UAlert
      v-if="errorMessage"
      class="mb-5"
      color="error"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: loadGroups }]"
    />
    <UAlert
      v-if="feedback"
      class="mb-5"
      color="success"
      :description="feedback"
    />
    <div
      v-if="loading"
      class="grid gap-4 sm:grid-cols-2"
      aria-busy="true"
      aria-label="Carregando grupos"
    >
      <USkeleton
        v-for="n in 4"
        :key="n"
        class="h-44 rounded-xl"
      />
    </div>
    <div
      v-else-if="filteredGroups.length"
      class="grid gap-4 sm:grid-cols-2"
    >
      <UCard
        v-for="group in filteredGroups"
        :key="group.id"
      >
        <div class="flex items-start gap-3">
          <UIcon
            name="i-lucide-users-round"
            class="mt-1 size-6 shrink-0 text-primary"
          />
          <div class="min-w-0">
            <h2 class="text-lg font-semibold">
              {{ group.name }}
            </h2>
            <p
              v-if="group.description"
              class="mt-2 whitespace-pre-line text-sm leading-6 text-muted"
            >
              {{ group.description }}
            </p>
          </div>
        </div>
        <template #footer>
          <div class="space-y-3">
            <UBadge
              v-if="memberships[group.id] === 'approved'"
              color="success"
              label="Você participa deste grupo"
              icon="i-lucide-check"
            />
            <template v-else-if="memberships[group.id] === 'pending'">
              <p class="text-sm text-muted">
                Solicitação enviada. Aguardando análise da liderança.
              </p>
              <UButton
                color="neutral"
                variant="outline"
                label="Cancelar solicitação"
                :loading="busyId === group.id"
                :disabled="Boolean(busyId)"
                @click="requestGroup(group, true)"
              />
            </template>
            <template v-else-if="memberships[group.id] === 'invited'">
              <p class="text-sm text-muted">
                Você recebeu um convite para este grupo. Fale com a liderança para confirmar os próximos passos.
              </p>
              <UButton
                to="/contato"
                color="neutral"
                variant="outline"
                label="Falar com a igreja"
              />
            </template>
            <template v-else-if="memberships[group.id] === 'rejected'">
              <p class="text-sm text-muted">
                A liderança não aprovou esta solicitação. Entre em contato para saber como participar.
              </p>
              <UButton
                to="/contato"
                color="neutral"
                variant="outline"
                label="Falar com a igreja"
              />
            </template>
            <UButton
              v-else
              label="Solicitar participação"
              icon="i-lucide-user-plus"
              :loading="busyId === group.id"
              :disabled="Boolean(busyId)"
              @click="requestGroup(group)"
            />
          </div>
        </template>
      </UCard>
    </div>
    <UCard
      v-else-if="!errorMessage"
      class="py-6 text-center"
    >
      <UIcon
        name="i-lucide-users-round"
        class="size-10 text-muted"
      />
      <h2 class="mt-3 font-semibold">
        {{ query ? 'Nenhum grupo encontrado' : 'Os grupos serão apresentados aqui' }}
      </h2>
      <p class="mt-2 text-sm text-muted">
        {{ query ? 'Tente outra palavra ou limpe a busca.' : 'Você já pode conhecer as células ou falar com a recepção sobre como participar.' }}
      </p>
      <UButton
        v-if="query"
        class="mt-4"
        color="neutral"
        variant="outline"
        label="Limpar busca"
        @click="query = ''"
      />
      <UButton
        v-else
        to="/celulas"
        class="mt-4"
        label="Conhecer as células"
      />
    </UCard>
  </div>
</template>
