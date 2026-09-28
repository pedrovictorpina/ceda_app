import { describe, expect, it } from 'vitest'
import type { SessionProfile, SystemRole } from '../app/types/domain'
import {
  dashboardShortcuts,
  describeChange,
  failedSection,
  formatCompactBRL,
  isMissingSchemaError,
  listPreview,
  percentChange,
  readySection,
  reloadingSection,
  initialSection,
  topProducts,
  UNAVAILABLE_MESSAGE
} from '../app/utils/adminDashboard'
import { buildAttentionItems, urgentCount } from '../app/utils/adminDashboardAttention'
import {
  checkinsTakeaway,
  membersTakeaway,
  productsTakeaway,
  revenueTakeaway,
  seriesSubtitle,
  seriesSummary
} from '../app/utils/adminDashboardCopy'
import {
  axisTicks,
  bucketGranularity,
  bucketSeries,
  buildBuckets,
  dashboardWindow,
  isDashboardPeriod,
  isEmptySeries,
  niceCeiling,
  peakPoint,
  seriesTotal,
  shiftDateKey,
  sumInRange,
  weekStartKey,
  zonedDateKey,
  zonedMidnightIso
} from '../app/utils/adminDashboardDates'

// Segunda-feira, 28/09/2026, 20:00 em Brasília (UTC-3).
const now = new Date('2026-09-28T23:00:00Z')

function profileWith(...roles: SystemRole[]): SessionProfile {
  return { id: 'u1', name: 'Ana', email: 'ana@ceda.org', roles, isApprovedGuardian: false, isChildrenTeam: false }
}

describe('date keys', () => {
  it('shifts dates across months and years', () => {
    expect(shiftDateKey('2026-09-28', 5)).toBe('2026-10-03')
    expect(shiftDateKey('2026-01-01', -1)).toBe('2025-12-31')
    expect(() => shiftDateKey('2026-02-30', 1)).toThrow(RangeError)
  })

  it('finds the Monday of the week', () => {
    expect(weekStartKey('2026-09-28')).toBe('2026-09-28')
    expect(weekStartKey('2026-10-04')).toBe('2026-09-28')
    expect(weekStartKey('2026-09-27')).toBe('2026-09-21')
  })

  it('reads instants in the Brasília calendar', () => {
    expect(zonedDateKey('2026-09-29T02:30:00Z')).toBe('2026-09-28')
    expect(zonedDateKey('2026-09-29T03:00:00Z')).toBe('2026-09-29')
    expect(zonedDateKey('2026-09-15')).toBe('2026-09-15')
    expect(zonedDateKey('not a date')).toBeNull()
    expect(zonedDateKey('2026-02-30')).toBeNull()
  })

  it('returns the UTC instant of Brasília midnight', () => {
    expect(zonedMidnightIso('2026-09-28')).toBe('2026-09-28T03:00:00.000Z')
  })
})

describe('dashboard window', () => {
  it('covers the period ending today and the previous period', () => {
    expect(dashboardWindow(7, now)).toEqual({
      period: 7,
      today: '2026-09-28',
      start: '2026-09-22',
      previousStart: '2026-09-15',
      previousEnd: '2026-09-21'
    })
    expect(dashboardWindow(30, now).start).toBe('2026-08-30')
  })

  it('validates periods and picks the granularity', () => {
    expect(isDashboardPeriod(30)).toBe(true)
    expect(isDashboardPeriod(14)).toBe(false)
    expect(isDashboardPeriod('30')).toBe(false)
    expect(bucketGranularity(7)).toBe('day')
    expect(bucketGranularity(30)).toBe('week')
    expect(bucketGranularity(90)).toBe('week')
  })
})

describe('buckets and series', () => {
  it('builds daily buckets with weekday labels', () => {
    const buckets = buildBuckets('2026-09-26', '2026-09-28', 'day')
    expect(buckets.map(bucket => bucket.key)).toEqual(['2026-09-26', '2026-09-27', '2026-09-28'])
    expect(buckets[0]?.label).toBe('26/09')
    expect(buckets[2]?.fullLabel).toMatch(/^seg\.? 28\/09$/)
  })

  it('builds Monday-aligned weekly buckets', () => {
    const buckets = buildBuckets('2026-09-10', '2026-09-28', 'week')
    expect(buckets.map(bucket => bucket.key)).toEqual(['2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'])
    expect(buckets[0]).toMatchObject({ label: '10/09', fullLabel: '10/09 a 13/09 (4 dias)' })
    expect(buckets[1]?.fullLabel).toBe('Semana de 14/09')
    expect(buckets[3]).toMatchObject({ label: '28/09', fullLabel: '28/09 (1 dia)' })
    expect(buildBuckets('2026-09-28', '2026-09-01', 'day')).toEqual([])
  })

  it('buckets by Brasília day, not by UTC', () => {
    const series = bucketSeries([
      { at: '2026-09-28T02:00:00Z' }, // 27/09 23:00 em Brasília
      { at: '2026-09-28T12:00:00Z' },
      { at: '2026-09-28T13:00:00Z', value: 2 },
      { at: '2026-09-20T12:00:00Z' }, // fora da janela
      { at: 'invalid' }
    ], { start: '2026-09-27', end: '2026-09-28' }, 'day')
    expect(series.map(point => point.value)).toEqual([1, 3])
  })

  it('sums values per week', () => {
    const series = bucketSeries([
      { at: '2026-09-15T15:00:00Z', value: 10 },
      { at: '2026-09-20T15:00:00Z', value: 5.5 },
      { at: '2026-09-27T15:00:00Z', value: 4 }
    ], { start: '2026-09-14', end: '2026-09-28' }, 'week')
    expect(series.map(point => [point.key, point.value])).toEqual([['2026-09-14', 15.5], ['2026-09-21', 4], ['2026-09-28', 0]])
    expect(seriesTotal(series)).toBe(19.5)
    expect(peakPoint(series)?.key).toBe('2026-09-14')
  })

  it('handles empty series', () => {
    const series = bucketSeries([], { start: '2026-09-22', end: '2026-09-28' }, 'day')
    expect(series).toHaveLength(7)
    expect(isEmptySeries(series)).toBe(true)
    expect(peakPoint(series)).toBeNull()
    expect(peakPoint([])).toBeNull()
    expect(seriesSummary([])).toBe('Sem dados no período.')
    expect(seriesSummary(series)).toContain('Todos os valores são zero.')
  })

  it('sums a date range inclusively', () => {
    const records = [{ at: '2026-09-21T12:00:00Z' }, { at: '2026-09-22T02:59:00Z' }, { at: '2026-09-22T03:00:00Z' }]
    expect(sumInRange(records, '2026-09-21', '2026-09-21')).toBe(2)
    expect(sumInRange(records, '2026-09-22', '2026-09-28')).toBe(1)
  })

  it('rounds the axis to clean numbers', () => {
    expect(niceCeiling(0)).toBe(1)
    expect(niceCeiling(3)).toBe(5)
    expect(niceCeiling(12)).toBe(20)
    expect(niceCeiling(1240)).toBe(2000)
    expect(axisTicks(3)).toEqual([0, 5])
    expect(axisTicks(12)).toEqual([0, 10, 20])
    expect(axisTicks(0.4, false)).toEqual([0, 0.25, 0.5])
  })
})

describe('comparisons', () => {
  it('computes the percent change', () => {
    expect(percentChange(12, 10)).toEqual({ direction: 'up', percent: 20 })
    expect(percentChange(5, 10)).toEqual({ direction: 'down', percent: -50 })
    expect(percentChange(10, 10)).toEqual({ direction: 'flat', percent: 0 })
    expect(percentChange(3, 0)).toEqual({ direction: 'new', percent: null })
    expect(percentChange(0, 0)).toEqual({ direction: 'none', percent: null })
    expect(percentChange(Number.NaN, 1)).toEqual({ direction: 'none', percent: null })
  })

  it('describes the change against the previous period', () => {
    expect(describeChange(percentChange(12, 10), 30)).toBe('+20% vs 30 dias anteriores')
    expect(describeChange(percentChange(5, 10), 7)).toBe('−50% vs 7 dias anteriores')
    expect(describeChange(percentChange(4, 4), 7)).toBe('igual aos 7 dias anteriores')
    expect(describeChange(percentChange(4, 0), 90, 'sem vendas')).toBe('sem vendas nos 90 dias anteriores')
  })
})

describe('store aggregates', () => {
  const orders = [
    { total_amount: 30, created_at: '2026-09-27T12:00:00Z', store_order_items: [
      { product_id: 'cafe', quantity: 3, unit_price: 5, product: { name: 'Café' } },
      { product_id: 'bolo', quantity: '1', unit_price: '15', product: [{ name: 'Bolo' }] }
    ] },
    { total_amount: 20, created_at: '2026-09-28T12:00:00Z', store_order_items: [
      { product_id: 'cafe', quantity: 2, unit_price: 5, product: { name: 'Café' } },
      { product_id: 'suco', quantity: 1, unit_price: 10, product: null }
    ] },
    { total_amount: 0, created_at: '2026-09-28T12:00:00Z', store_order_items: null }
  ]

  it('ranks the best sellers by quantity', () => {
    expect(topProducts(orders)).toEqual([
      { id: 'cafe', name: 'Café', quantity: 5, revenue: 25 },
      { id: 'bolo', name: 'Bolo', quantity: 1, revenue: 15 },
      { id: 'suco', name: 'Produto removido', quantity: 1, revenue: 10 }
    ])
    expect(topProducts(orders, 1)).toHaveLength(1)
    expect(topProducts([], 5)).toEqual([])
  })

  it('formats compact money for the axis', () => {
    expect(formatCompactBRL(800)).toMatch(/R\$\s800/)
    expect(formatCompactBRL(1200)).toMatch(/^R\$ 1,2\s?mil$/)
  })
})

describe('section states', () => {
  it('treats a missing table or function as unavailable', () => {
    expect(isMissingSchemaError({ code: 'PGRST205', message: 'Could not find the table' })).toBe(true)
    expect(isMissingSchemaError({ code: 'PGRST202' })).toBe(true)
    expect(isMissingSchemaError({ message: 'relation "public.children_checkins" does not exist' })).toBe(true)
    expect(isMissingSchemaError({ code: '42501', message: 'permission denied' })).toBe(false)
    expect(isMissingSchemaError(null)).toBe(false)
    expect(failedSection({ code: 'PGRST205' }, 'Falhou.')).toMatchObject({ status: 'unavailable', message: UNAVAILABLE_MESSAGE })
    expect(failedSection(new Error('network'), 'Falhou.')).toMatchObject({ status: 'error', message: 'Falhou.' })
  })

  it('keeps previous data while reloading', () => {
    expect(reloadingSection(initialSection<number>())).toEqual(initialSection<number>())
    expect(reloadingSection(readySection(4))).toEqual({ status: 'ready', data: 4, message: '', refreshing: true })
  })
})

describe('attention list', () => {
  it('orders actionable items and skips empty or missing sources', () => {
    const items = buildAttentionItems({
      pendingMemberships: 2,
      pendingVisits: { count: 3, cellIds: ['c1'] },
      awaitingOrders: 0,
      lowStock: [{ name: 'Bolo', stock: 4 }, { name: 'Café', stock: 1 }, { name: 'Suco', stock: 2 }],
      pastoralPrayers: null,
      scheduledToday: [{ title: 'Palavra do Dia', at: '2026-09-28T23:30:00Z' }],
      eventsThisWeek: [],
      drafts: 1
    })
    expect(items.map(item => item.id)).toEqual(['memberships', 'visits', 'stock', 'scheduled', 'drafts'])
    expect(items[0]?.title).toBe('2 solicitações de participação')
    expect(items[1]).toMatchObject({ to: '/celulas/c1', title: '3 pedidos de visita aguardando contato' })
    expect(items[2]?.detail).toBe('Café, Suco e mais 1: até 5 unidades.')
    expect(items[3]?.detail).toBe('Próxima: Palavra do Dia, às 20:30.')
    expect(items[4]?.title).toBe('1 rascunho sem publicar')
    expect(urgentCount(items)).toBe(2 + 3 + 3)
  })

  it('links to the cells list when requests span several cells', () => {
    const [item] = buildAttentionItems({ pendingVisits: { count: 2, cellIds: ['a', 'b'] } })
    expect(item).toMatchObject({ to: '/celulas', detail: 'Em 2 células.' })
    expect(buildAttentionItems({})).toEqual([])
  })

  it('previews names', () => {
    expect(listPreview([])).toBe('')
    expect(listPreview(['Ana'])).toBe('Ana')
    expect(listPreview(['Ana', 'Bia'])).toBe('Ana e Bia')
    expect(listPreview(['Ana', 'Bia', 'Caio', 'Davi'])).toBe('Ana, Bia e mais 2')
  })
})

describe('shortcuts', () => {
  it('shows every area to administrators', () => {
    expect(dashboardShortcuts(profileWith('administrator')).map(item => item.id))
      .toEqual(['content', 'event', 'people', 'cash', 'stock', 'reports', 'children', 'cells', 'audit'])
  })

  it('hides children classes from pastors who do not teach', () => {
    const ids = dashboardShortcuts(profileWith('pastor')).map(item => item.id)
    expect(ids).not.toContain('children')
    expect(ids).toContain('content')
  })

  it('keeps only store areas for a cashier', () => {
    expect(dashboardShortcuts(profileWith('cashier')).map(item => item.id)).toEqual(['cash', 'stock', 'reports', 'cells'])
    expect(dashboardShortcuts(null)).toEqual([])
  })
})

describe('takeaway titles', () => {
  it('states the conclusion of each chart', () => {
    expect(membersTakeaway(12, percentChange(12, 10), 30)).toBe('12 novos cadastros em 30 dias, 20% a mais que no período anterior')
    expect(membersTakeaway(1, percentChange(1, 0), 7)).toBe('1 novo cadastro em 7 dias')
    expect(membersTakeaway(0, percentChange(0, 3), 7)).toBe('Nenhum cadastro novo nos últimos 7 dias')
    expect(revenueTakeaway(50, percentChange(50, 100), 30)).toMatch(/^R\$\s50,00 em vendas confirmadas, 50% a menos que no período anterior$/)
    expect(productsTakeaway([{ id: 'c', name: 'Café', quantity: 5, revenue: 25 }], 30)).toBe('Café lidera, com 5 unidades vendidas')
    expect(productsTakeaway([], 30)).toBe('Nenhum produto vendido nos últimos 30 dias')
    expect(checkinsTakeaway(0, 90)).toBe('Nenhum check-in no Sementinhas nos últimos 90 dias')
  })

  it('describes granularity and peak', () => {
    const series = bucketSeries([{ at: '2026-09-15T15:00:00Z' }], { start: '2026-09-14', end: '2026-09-28' }, 'week')
    expect(seriesSubtitle(series, 'week', 30)).toBe('Por semana, últimos 30 dias. Pico: semana de 14/09, com 1.')
  })
})
