import { describe, expect, it } from 'vitest'
import { cashSelectionChanges } from '../app/utils/storeCashSelection'

describe('cashSelectionChanges', () => {
  it('adds only products not already saved when selecting all', () => {
    expect(cashSelectionChanges(['a', 'b', 'c'], ['a'])).toEqual({ add: ['b', 'c'], remove: [] })
  })

  it('reconciles changes made while a previous selection was saving', () => {
    expect(cashSelectionChanges(['a', 'c'], ['a', 'b'])).toEqual({ add: ['c'], remove: ['b'] })
  })
})
