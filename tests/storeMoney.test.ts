import { describe, expect, it } from 'vitest'
import { parseMoneyInput } from '../app/utils/storeMoney'

describe('parseMoneyInput', () => {
  it('interprets typed digits as cents', () => {
    expect(parseMoneyInput('R$ 1.234,56')).toBe(1234.56)
    expect(parseMoneyInput('R$ 0,01')).toBe(0.01)
    expect(parseMoneyInput('')).toBe(0)
  })
})
