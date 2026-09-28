import type { Ref } from 'vue'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  failedSection,
  hiddenSection,
  initialSection,
  readySection,
  reloadingSection,
  type SectionState
} from '~/utils/adminDashboard'
import { buildAttentionItems, type AttentionItem, type VisitRequestsSummary } from '~/utils/adminDashboardAttention'
import { DEFAULT_DASHBOARD_PERIOD, dashboardWindow, type DashboardPeriod } from '~/utils/adminDashboardDates'
import { hasRole } from '~/utils/authorization'
import {
  fetchBirthdays,
  fetchCells,
  fetchChildren,
  fetchContent,
  fetchEvents,
  fetchMembers,
  fetchPastoralPrayers,
  fetchPendingMemberships,
  fetchPendingVisits,
  fetchStoreQueue,
  fetchStoreSales,
  type BirthdaysData,
  type CellsData,
  type ChildrenData,
  type ContentData,
  type EventsData,
  type MembersData,
  type StoreQueueData,
  type StoreSalesData
} from './useAdminDashboardSources'

const OFFLINE_MESSAGE = 'O serviço de dados está indisponível. Verifique a conexão e tente novamente.'

/**
 * Estado do painel administrativo. Cada seção carrega em paralelo e falha
 * sozinha: um erro (ou uma migração ainda não aplicada) nunca derruba o painel.
 */
export function useAdminDashboard() {
  const auth = useAuthStore()
  const period = ref<DashboardPeriod>(DEFAULT_DASHBOARD_PERIOD)
  const updatedAt = ref<Date | null>(null)

  const members = shallowRef(initialSection<MembersData>())
  const sales = shallowRef(initialSection<StoreSalesData>())
  const children = shallowRef(initialSection<ChildrenData>())
  const queue = shallowRef(initialSection<StoreQueueData>())
  const memberships = shallowRef(initialSection<number>())
  const prayers = shallowRef(initialSection<number>())
  const visits = shallowRef(initialSection<VisitRequestsSummary>())
  const events = shallowRef(initialSection<EventsData>())
  const cells = shallowRef(initialSection<CellsData>())
  const birthdays = shallowRef(initialSection<BirthdaysData>())
  const content = shallowRef(initialSection<ContentData>())

  // Sementinhas: o RLS libera todos os check-ins somente para administradores.
  const showChildren = computed(() => hasRole(auth.profile, 'administrator'))
  let periodRequest = 0

  async function run<T>(target: Ref<SectionState<T>>, loader: () => Promise<T>, fallback: string, isCurrent: () => boolean = () => true) {
    target.value = reloadingSection(target.value)
    try {
      const data = await loader()
      if (isCurrent()) target.value = readySection(data)
    } catch (error) {
      if (!isCurrent()) return
      if (import.meta.dev) console.warn('[painel] falha ao carregar seção', error)
      target.value = failedSection<T>(error, fallback)
    }
  }

  function periodSections(client: SupabaseClient) {
    const request = ++periodRequest
    const isCurrent = () => request === periodRequest
    const window = dashboardWindow(period.value)
    const jobs = [
      run(members, () => fetchMembers(client, window), 'Não foi possível carregar os cadastros.', isCurrent),
      run(sales, () => fetchStoreSales(client, window), 'Não foi possível carregar as vendas da loja.', isCurrent)
    ]
    if (showChildren.value) jobs.push(run(children, () => fetchChildren(client, window), 'Não foi possível carregar os check-ins do Sementinhas.', isCurrent))
    else children.value = hiddenSection()
    return jobs
  }

  function steadySections(client: SupabaseClient) {
    const today = dashboardWindow(period.value).today
    return [
      run(queue, () => fetchStoreQueue(client), 'Não foi possível carregar pedidos e estoque.'),
      run(memberships, () => fetchPendingMemberships(client), 'Não foi possível carregar as solicitações.'),
      run(prayers, () => fetchPastoralPrayers(client), 'Não foi possível carregar os pedidos de oração.'),
      run(visits, () => fetchPendingVisits(client), 'Não foi possível carregar os pedidos de visita.'),
      run(events, () => fetchEvents(client), 'Não foi possível carregar a agenda.'),
      run(cells, () => fetchCells(client), 'Não foi possível carregar as células.'),
      run(birthdays, () => fetchBirthdays(client, today), 'Não foi possível carregar os aniversariantes.'),
      run(content, () => fetchContent(client, today), 'Não foi possível carregar as publicações.')
    ]
  }

  const allSections = [members, sales, children, queue, memberships, prayers, visits, events, cells, birthdays, content] as unknown as Array<Ref<SectionState<unknown>>>

  function client(): SupabaseClient | null {
    const { $supabase } = useNuxtApp()
    if ($supabase) return $supabase
    for (const section of allSections) section.value = failedSection(null, OFFLINE_MESSAGE)
    return null
  }

  async function refresh() {
    const supabase = client()
    if (!supabase) return
    await Promise.all([...periodSections(supabase), ...steadySections(supabase)])
    updatedAt.value = new Date()
  }

  async function setPeriod(value: DashboardPeriod) {
    if (value === period.value) return
    period.value = value
    const supabase = client()
    if (!supabase) return
    await Promise.all(periodSections(supabase))
    updatedAt.value = new Date()
  }

  const attention = computed<AttentionItem[]>(() => buildAttentionItems({
    pendingMemberships: memberships.value.data,
    pendingVisits: visits.value.data,
    awaitingOrders: queue.value.data?.awaitingOrders ?? null,
    lowStock: queue.value.data?.lowStock ?? null,
    pastoralPrayers: prayers.value.data,
    scheduledToday: content.value.data?.scheduledToday ?? null,
    eventsThisWeek: events.value.data?.thisWeek ?? null,
    drafts: content.value.data?.drafts ?? null
  }))

  const attentionSources = [memberships, visits, queue, prayers, content, events]
  const attentionLoading = computed(() => attentionSources.some(section => section.value.status === 'loading'))
  const attentionFailures = computed(() => attentionSources.filter(section => section.value.status === 'error').length)
  const refreshing = computed(() => allSections.some(section => section.value.refreshing || section.value.status === 'loading'))

  return {
    period,
    updatedAt,
    refreshing,
    showChildren,
    members,
    sales,
    children,
    queue,
    memberships,
    prayers,
    visits,
    events,
    cells,
    birthdays,
    content,
    attention,
    attentionLoading,
    attentionFailures,
    refresh,
    setPeriod
  }
}
