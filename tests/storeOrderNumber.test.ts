import { describe, expect, it } from 'vitest'
import { displayOrderNumber } from '../app/utils/storeOrderNumber'

describe('displayOrderNumber', () => {
  it('identifies the cash day for a daily number', () => {
    expect(displayOrderNumber({ order_number: 901, daily_order_number: 1, daily_order_date: '2026-11-15' }))
      .toBe('#1 · caixa 15/11/2026')
  })

  it('keeps the global number for older orders', () => {
    expect(displayOrderNumber({ order_number: 91, daily_order_number: null, daily_order_date: null }))
      .toBe('#91 · anterior')
  })
})
