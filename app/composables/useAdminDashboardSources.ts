import type { SupabaseClient } from '@supabase/supabase-js'
import {
  LOW_STOCK_THRESHOLD,
  PAID_ORDER_STATUSES,
  percentChange,
  topProducts,
  type Change,
  type DatabaseErrorShape,
  type PaidOrderRow,
  type ProductRank
} from '~/utils/adminDashboard'
import type { DatedTitle, LowStockEntry, VisitRequestsSummary } from '~/utils/adminDashboardAttention'
import {
  bucketGranularity,
  bucketSeries,
  shiftDateKey,
  sumInRange,
  zonedDateKey,
  zonedMidnightIso,
  type BucketGranularity,
  type DashboardWindow,
  type SeriesPoint
} from '~/utils/adminDashboardDates'
import { mapBirthdayRows, shortDisplayName } from '~/utils/birthdays'

/*
 * Consultas do painel administrativo. Cada função lê somente as colunas
 * necessárias, respeita o RLS da sessão atual e lança o erro do Supabase para
 * que o painel trate cada seção de forma independente.
 */

const SERIES_ROW_LIMIT = 5000
const DAY_MS = 86_400_000

export interface MembersData {
  total: number
  newInPeriod: number
  change: Change
  granularity: BucketGranularity
  series: SeriesPoint[]
}

export interface StoreSalesData {
  revenue: number
  orders: number
  averageTicket: number
  change: Change
  granularity: BucketGranularity
  series: SeriesPoint[]
  ranking: ProductRank[]
}

export interface StoreQueueData {
  awaitingOrders: number
  lowStock: LowStockEntry[]
}

export interface EventsData {
  next30Days: number
  thisWeek: DatedTitle[]
}

export interface CellsData {
  active: number
  participants: number
}

export interface ChildrenData {
  today: number
  total: number
  granularity: BucketGranularity
  series: SeriesPoint[]
}

export interface BirthdaysData {
  count: number
  today: number
  names: string[]
}

export interface ContentData {
  scheduledToday: DatedTitle[]
  drafts: number
}

interface QueryResult<T> {
  data: T | null
  error: DatabaseErrorShape | null
  count?: number | null
}

function unwrap<T>(result: QueryResult<T>): T {
  if (result.error) throw result.error
  return result.data as T
}

function unwrapCount(result: QueryResult<unknown>): number {
  if (result.error) throw result.error
  return result.count ?? 0
}

export async function fetchMembers(client: SupabaseClient, window: DashboardWindow): Promise<MembersData> {
  const [total, recent] = await Promise.all([
    client.from('profiles').select('id', { count: 'exact', head: true }),
    client.from('profiles').select('created_at')
      .gte('created_at', zonedMidnightIso(window.previousStart))
      .order('created_at').limit(SERIES_ROW_LIMIT)
  ])
  const rows = (unwrap(recent) as Array<{ created_at: string }> | null) ?? []
  const records = rows.map(row => ({ at: row.created_at }))
  const granularity = bucketGranularity(window.period)
  const newInPeriod = sumInRange(records, window.start, window.today)
  return {
    total: unwrapCount(total),
    newInPeriod,
    change: percentChange(newInPeriod, sumInRange(records, window.previousStart, window.previousEnd)),
    granularity,
    series: bucketSeries(records, { start: window.start, end: window.today }, granularity)
  }
}

export async function fetchStoreSales(client: SupabaseClient, window: DashboardWindow): Promise<StoreSalesData> {
  const result = await client.from('store_orders')
    .select('total_amount, created_at, store_order_items(product_id, quantity, unit_price, product:store_products(name))')
    .in('status', [...PAID_ORDER_STATUSES])
    .gte('created_at', zonedMidnightIso(window.previousStart))
    .order('created_at').limit(SERIES_ROW_LIMIT)
  const orders = (unwrap(result) as PaidOrderRow[] | null) ?? []
  const records = orders.map(order => ({ at: order.created_at, value: Number(order.total_amount) || 0 }))
  const current = orders.filter((order) => {
    const key = zonedDateKey(order.created_at)
    return key !== null && key >= window.start && key <= window.today
  })
  const revenue = sumInRange(records, window.start, window.today)
  const granularity = bucketGranularity(window.period)
  return {
    revenue,
    orders: current.length,
    averageTicket: current.length ? revenue / current.length : 0,
    change: percentChange(revenue, sumInRange(records, window.previousStart, window.previousEnd)),
    granularity,
    series: bucketSeries(records, { start: window.start, end: window.today }, granularity),
    ranking: topProducts(current, 5)
  }
}

export async function fetchStoreQueue(client: SupabaseClient): Promise<StoreQueueData> {
  const [awaiting, products] = await Promise.all([
    client.from('store_orders').select('id', { count: 'exact', head: true }).eq('status', 'awaiting_payment'),
    client.from('store_products').select('name, stock_available')
      .eq('active', true).lte('stock_available', LOW_STOCK_THRESHOLD)
      .order('stock_available').limit(50)
  ])
  const rows = (unwrap(products) as Array<{ name: string, stock_available: number | string }> | null) ?? []
  return {
    awaitingOrders: unwrapCount(awaiting),
    lowStock: rows.map(row => ({ name: row.name, stock: Number(row.stock_available) || 0 }))
  }
}

export async function fetchPendingMemberships(client: SupabaseClient): Promise<number> {
  return unwrapCount(await client.from('community_memberships')
    .select('user_id', { count: 'exact', head: true }).eq('status', 'pending'))
}

export async function fetchPastoralPrayers(client: SupabaseClient): Promise<number> {
  return unwrapCount(await client.from('prayer_requests')
    .select('id', { count: 'exact', head: true }).eq('visibility', 'pastoral').eq('status', 'active'))
}

/** Tabela criada pela migração de diretório de células (pode ainda não existir). */
export async function fetchPendingVisits(client: SupabaseClient): Promise<VisitRequestsSummary> {
  const rows = (unwrap(await client.from('cell_visit_requests')
    .select('cell_id').eq('status', 'pending').limit(500)) as Array<{ cell_id: string }> | null) ?? []
  return { count: rows.length, cellIds: [...new Set(rows.map(row => row.cell_id))] }
}

export async function fetchEvents(client: SupabaseClient, now: Date = new Date()): Promise<EventsData> {
  const rows = (unwrap(await client.from('events').select('title, starts_at')
    .is('cancelled_at', null)
    .gte('starts_at', now.toISOString())
    .lt('starts_at', new Date(now.getTime() + 30 * DAY_MS).toISOString())
    .order('starts_at').limit(200)) as Array<{ title: string, starts_at: string }> | null) ?? []
  const weekLimit = now.getTime() + 7 * DAY_MS
  return {
    next30Days: rows.length,
    thisWeek: rows.filter(row => new Date(row.starts_at).getTime() < weekLimit).map(row => ({ title: row.title, at: row.starts_at }))
  }
}

export async function fetchCells(client: SupabaseClient): Promise<CellsData> {
  const cells = (unwrap(await client.from('cells').select('community_id').eq('active', true).limit(500)) as Array<{ community_id: string }> | null) ?? []
  const ids = cells.map(cell => cell.community_id)
  if (!ids.length) return { active: 0, participants: 0 }
  const members = (unwrap(await client.from('community_memberships').select('user_id')
    .eq('status', 'approved').in('community_id', ids).limit(SERIES_ROW_LIMIT)) as Array<{ user_id: string }> | null) ?? []
  return { active: ids.length, participants: new Set(members.map(row => row.user_id)).size }
}

/** Tabela do Sementinhas (migração pendente em alguns ambientes); só administradores leem tudo. */
export async function fetchChildren(client: SupabaseClient, window: DashboardWindow): Promise<ChildrenData> {
  const rows = (unwrap(await client.from('children_checkins').select('checked_in_at')
    .gte('checked_in_at', zonedMidnightIso(window.start))
    .order('checked_in_at').limit(SERIES_ROW_LIMIT)) as Array<{ checked_in_at: string }> | null) ?? []
  const records = rows.map(row => ({ at: row.checked_in_at }))
  const granularity = bucketGranularity(window.period)
  return {
    today: sumInRange(records, window.today, window.today),
    total: sumInRange(records, window.start, window.today),
    granularity,
    series: bucketSeries(records, { start: window.start, end: window.today }, granularity)
  }
}

export async function fetchBirthdays(client: SupabaseClient, today: string): Promise<BirthdaysData> {
  const people = mapBirthdayRows(unwrap(await client.rpc('list_birthdays', { p_period: 'week' })))
  return {
    count: people.length,
    today: people.filter(person => person.celebrationDate === today).length,
    names: people.map(person => shortDisplayName(person.fullName))
  }
}

export async function fetchContent(client: SupabaseClient, today: string, now: Date = new Date()): Promise<ContentData> {
  const [scheduled, drafts] = await Promise.all([
    client.from('daily_messages').select('title, publish_at')
      .in('status', ['scheduled', 'published'])
      .gte('publish_at', now.toISOString())
      .lt('publish_at', zonedMidnightIso(shiftDateKey(today, 1)))
      .order('publish_at').limit(20),
    client.from('daily_messages').select('id', { count: 'exact', head: true }).eq('status', 'draft')
  ])
  const rows = (unwrap(scheduled) as Array<{ title: string, publish_at: string }> | null) ?? []
  return {
    scheduledToday: rows.map(row => ({ title: row.title, at: row.publish_at })),
    drafts: unwrapCount(drafts)
  }
}
