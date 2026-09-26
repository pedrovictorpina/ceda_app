<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Administração' })

const dashboard = reactive({
  members: null as number | null,
  cells: null as number | null,
  pendingMemberships: null as number | null,
  visiblePrayerRequests: null as number | null
})
const loading = ref(true)
const loadError = ref('')

const metricCards = computed(() => [
  {
    label: 'Membros cadastrados',
    value: dashboard.members,
    icon: 'i-lucide-users-round',
    detail: 'Perfis com acesso à comunidade.'
  },
  {
    label: 'Células ativas',
    value: dashboard.cells,
    icon: 'i-lucide-house-heart',
    detail: 'Estruturas de células cadastradas.'
  },
  {
    label: 'Solicitações pendentes',
    value: dashboard.pendingMemberships,
    icon: 'i-lucide-user-round-check',
    detail: 'Entradas aguardando análise.'
  },
  {
    label: 'Pedidos pastorais visíveis',
    value: dashboard.visiblePrayerRequests,
    icon: 'i-lucide-heart-handshake',
    detail: 'Pedidos acessíveis à gestão.'
  }
])

const shortcuts = [
  {
    title: 'Células',
    description: 'Crie células, atribua liderança e acompanhe convites.',
    icon: 'i-lucide-house-heart',
    to: '/celulas',
    action: 'Gerenciar células'
  },
  {
    title: 'Ovelhinhas',
    description: 'Acesse a área protegida de crianças e responsáveis.',
    icon: 'i-lucide-baby',
    to: '/ovelhinhas',
    action: 'Abrir área infantil'
  },
  {
    title: 'Pedidos de oração',
    description: 'Acompanhe os pedidos disponíveis para a equipe pastoral.',
    icon: 'i-lucide-heart',
    to: '/oracao',
    action: 'Ver pedidos'
  },
  {
    title: 'Pessoas e permissões',
    description: 'Perfis, papéis atuais e solicitações de participação.',
    icon: 'i-lucide-shield-check',
    to: '/admin/pessoas',
    action: 'Gerenciar pessoas'
  },
  {
    title: 'Conteúdo e avisos',
    description: 'Publicações, mensagens diárias e comunicados internos.',
    icon: 'i-lucide-megaphone',
    to: '/admin/conteudo',
    action: 'Gerenciar conteúdo'
  },
  {
    title: 'Auditoria',
    description: 'Acompanhe decisões administrativas e alterações editoriais.',
    icon: 'i-lucide-scroll-text',
    to: '/admin/auditoria',
    action: 'Ver histórico'
  },
  {
    title: 'Agenda e eventos',
    description: 'Programação, responsáveis e lembretes para a comunidade.',
    icon: 'i-lucide-calendar-cog',
    to: '/admin/agenda',
    action: 'Gerenciar agenda'
  }
]

const pendingItems = computed(() => [
  {
    label: 'Solicitações de participação',
    value: dashboard.pendingMemberships,
    icon: 'i-lucide-user-round-plus',
    to: '/admin/pessoas?view=pending'
  },
  {
    label: 'Pedidos para acompanhamento pastoral',
    value: dashboard.visiblePrayerRequests,
    icon: 'i-lucide-heart',
    to: '/oracao'
  }
])

function formatMetric(value: number | null) {
  if (value === null) return '—'
  return new Intl.NumberFormat('pt-BR').format(value)
}

async function loadDashboard() {
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    loadError.value = 'Não foi possível carregar os indicadores porque o serviço de dados está indisponível.'
    loading.value = false
    return
  }

  loading.value = true
  loadError.value = ''
  const [members, cells, memberships, prayers] = await Promise.all([
    $supabase.from('profiles').select('id', { count: 'exact', head: true }),
    $supabase.from('cells').select('community_id', { count: 'exact', head: true }),
    $supabase.from('community_memberships').select('user_id', { count: 'exact', head: true }).eq('status', 'pending'),
    $supabase.from('prayer_requests').select('id', { count: 'exact', head: true })
  ])

  dashboard.members = members.count ?? 0
  dashboard.cells = cells.count ?? 0
  dashboard.pendingMemberships = memberships.count ?? 0
  dashboard.visiblePrayerRequests = prayers.count ?? 0
  if ([members, cells, memberships, prayers].some(result => result.error)) {
    loadError.value = 'Alguns indicadores não puderam ser carregados. As permissões e os dados permanecem protegidos.'
  }
  loading.value = false
}

onMounted(loadDashboard)
</script>

<template>
  <div>
    <PageIntro
      title="Visão administrador"
      description="Acompanhe a comunidade, priorize pendências e acesse as áreas de gestão da CEDA."
      icon="i-lucide-shield-check"
    />

    <BrandLoader
      v-if="loading"
      class="my-5"
      label="Carregando painel…"
    />

    <UAlert
      color="primary"
      variant="subtle"
      title="Ambiente administrativo"
      description="Os números e atalhos abaixo usam a sessão atual e as permissões do seu papel."
    />

    <section
      class="mt-6"
      aria-labelledby="overview-title"
    >
      <div class="flex items-end justify-between gap-4">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Panorama
          </p>
          <h2
            id="overview-title"
            class="mt-1 text-2xl font-bold"
          >
            Indicadores da comunidade
          </h2>
        </div>
        <UButton
          color="neutral"
          variant="outline"
          size="sm"
          icon="i-lucide-refresh-cw"
          label="Atualizar"
          :loading="loading"
          @click="loadDashboard"
        />
      </div>

      <div class="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <UCard
          v-for="metric in metricCards"
          :key="metric.label"
        >
          <UIcon
            :name="metric.icon"
            class="size-6 text-primary"
          />
          <USkeleton
            v-if="loading"
            class="mt-4 h-9 w-20"
          />
          <p
            v-else
            class="mt-4 text-3xl font-bold tracking-tight"
          >
            {{ formatMetric(metric.value) }}
          </p>
          <h3 class="mt-1 font-semibold">
            {{ metric.label }}
          </h3>
          <p class="mt-1 text-sm leading-6 text-muted">
            {{ metric.detail }}
          </p>
        </UCard>
      </div>

      <UAlert
        v-if="loadError"
        class="mt-4"
        color="warning"
        variant="subtle"
        :description="loadError"
      />
    </section>

    <div class="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.55fr)]">
      <section aria-labelledby="shortcuts-title">
        <p class="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
          Gestão
        </p>
        <h2
          id="shortcuts-title"
          class="mt-1 text-2xl font-bold"
        >
          Áreas administrativas
        </h2>
        <div class="mt-5 grid gap-4 md:grid-cols-2">
          <UCard
            v-for="shortcut in shortcuts"
            :key="shortcut.title"
          >
            <UIcon
              :name="shortcut.icon"
              class="size-7 text-primary"
            />
            <h3 class="mt-4 text-lg font-semibold">
              {{ shortcut.title }}
            </h3>
            <p class="mt-2 min-h-12 text-sm leading-6 text-muted">
              {{ shortcut.description }}
            </p>
            <template #footer>
              <UButton
                v-if="shortcut.to"
                :to="shortcut.to"
                size="sm"
                color="neutral"
                variant="outline"
                trailing-icon="i-lucide-arrow-right"
                :label="shortcut.action"
              />
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                label="Em construção"
              />
            </template>
          </UCard>
        </div>
      </section>

      <aside aria-labelledby="pending-title">
        <UCard class="h-full bg-elevated/50">
          <template #header>
            <div class="flex items-center gap-3">
              <div class="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <UIcon
                  name="i-lucide-list-todo"
                  class="size-5"
                />
              </div>
              <div>
                <h2
                  id="pending-title"
                  class="font-semibold"
                >
                  Pendências
                </h2>
                <p class="text-sm text-muted">
                  Itens para revisar
                </p>
              </div>
            </div>
          </template>

          <div class="space-y-3">
            <NuxtLink
              v-for="item in pendingItems"
              :key="item.label"
              :to="item.to"
              class="focus-ring flex items-center gap-3 rounded-xl border border-default bg-default p-3 transition hover:border-primary/30 hover:bg-primary/5"
            >
              <UIcon
                :name="item.icon"
                class="size-5 shrink-0 text-primary"
              />
              <span class="min-w-0 flex-1 text-sm font-medium">{{ item.label }}</span>
              <USkeleton
                v-if="loading"
                class="h-6 w-8"
              />
              <UBadge
                v-else
                color="neutral"
                variant="subtle"
                :label="formatMetric(item.value)"
              />
            </NuxtLink>
          </div>

          <template #footer>
            <p class="text-sm leading-6 text-muted">
              Pessoas, conteúdo e agenda já estão disponíveis para a gestão.
            </p>
          </template>
        </UCard>
      </aside>
    </div>
  </div>
</template>
