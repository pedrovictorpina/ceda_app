import { describe, expect, it } from 'vitest'
import { financeSummary, financeUtcSearchBounds, saleDate } from '../app/utils/storeFinance'

describe('store finance summary', () => {
  it('groups payments by Sao Paulo date and calculates in cents, excluding voided entries', () => {
    const result = financeSummary([
      { confirmed_at: '2026-11-15T01:30:00Z', payment_method: 'pix', total_amount: 0.1 },
      { confirmed_at: '2026-11-15T02:30:00Z', payment_method: 'pix', total_amount: 0.2 }
    ], [
      { id: '1', entry_date: '2026-11-14', kind: 'donation', description: 'A', amount: 5, voided_at: null },
      { id: '2', entry_date: '2026-11-14', kind: 'expense', description: 'B', amount: 2.1, voided_at: null },
      { id: '3', entry_date: '2026-11-14', kind: 'expense', description: 'C', amount: 100, voided_at: '2026-11-15' }
    ])
    expect(result.rows).toEqual([{ date: '2026-11-14', method: 'pix', cents: 30 }])
    expect(result.balanceCents).toBe(320)
  })

  it('uses broad UTC bounds and the actual Sao Paulo date even during historical daylight saving time', () => {
    const bounds = financeUtcSearchBounds('2018-11-04', '2018-11-04')
    expect(bounds).toEqual({ start: '2018-11-03T00:00:00.000Z', end: '2018-11-06T00:00:00.000Z' })
    expect(saleDate('2018-11-04T02:30:00Z')).toBe('2018-11-03')
    expect(saleDate('2018-11-04T03:00:00Z')).toBe('2018-11-04')
  })
})
