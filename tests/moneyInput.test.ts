import { describe, expect, it } from 'vitest'
import { formatPriceInput, parsePriceInput } from '../app/utils/moneyInput'

describe('price input', () => {
  it('interprets typed digits as cents and formats reais', () => {
    expect(parsePriceInput('R$ 0,01')).toBe(0.01)
    expect(parsePriceInput('R$ 1.234,56')).toBe(1234.56)
    expect(formatPriceInput(1234.56)).toMatch(/1\.234,56/)
  })

  it('handles clearing and keeps the value within the database precision', () => {
    expect(parsePriceInput('')).toBe(0)
    expect(parsePriceInput('9999999999999')).toBe(9999999999.99)
  })
})
