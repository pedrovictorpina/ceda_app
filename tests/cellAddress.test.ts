import { describe, expect, it } from 'vitest'
import {
  cellAreaLabel,
  cellDetailsRpcArgs,
  cellMapsQuery,
  emptyCellDetailsForm,
  googleMapsUrl,
  normalizePostalCode,
  validateCellDetails
} from '../app/utils/cellAddress'

const address = {
  addressLine: 'Rua das Flores, 100',
  neighborhood: 'Jardim Paulista',
  city: 'São Paulo',
  region: 'SP',
  postalCode: '01415-000'
}

describe('cell address helpers', () => {
  it('builds a Google Maps search link with the encoded full address', () => {
    expect(googleMapsUrl(address)).toBe(
      'https://www.google.com/maps/search/?api=1&query=Rua%20das%20Flores%2C%20100%2C%20Jardim%20Paulista%2C%20S%C3%A3o%20Paulo%2C%20SP%2C%2001415-000'
    )
  })

  it('falls back to neighborhood and city when the full address is hidden', () => {
    expect(cellMapsQuery({ neighborhood: 'Centro', city: 'Campinas', region: 'SP' })).toBe('Centro, Campinas, SP')
    expect(googleMapsUrl({})).toBe('')
  })

  it('labels the area for cards', () => {
    expect(cellAreaLabel(address)).toBe('Jardim Paulista · São Paulo/SP')
    expect(cellAreaLabel({ city: 'Campinas' })).toBe('Campinas')
    expect(cellAreaLabel({})).toBe('')
  })

  it('normalizes postal codes', () => {
    expect(normalizePostalCode('01415000')).toBe('01415-000')
    expect(normalizePostalCode('01415-000')).toBe('01415-000')
    expect(normalizePostalCode('')).toBe('')
    expect(normalizePostalCode('1234')).toBeNull()
  })
})

describe('validateCellDetails', () => {
  it('accepts a cell without address', () => {
    expect(validateCellDetails({ ...emptyCellDetailsForm(), name: 'Célula Esperança' })).toEqual({})
  })

  it('requires every address part once any part is filled', () => {
    const errors = validateCellDetails({ ...emptyCellDetailsForm(), name: 'Célula Esperança', city: 'São Paulo' })
    expect(Object.keys(errors).sort()).toEqual(['addressLine', 'neighborhood', 'region'])
  })

  it('validates name, weekday, time and postal code', () => {
    const errors = validateCellDetails({ ...emptyCellDetailsForm(), ...address, name: 'AB', weekday: 9, time: '8h', postalCode: '123' })
    expect(Object.keys(errors).sort()).toEqual(['name', 'postalCode', 'time', 'weekday'])
  })

  it('maps the form to RPC arguments with trimmed and nullable values', () => {
    const args = cellDetailsRpcArgs({ ...emptyCellDetailsForm(), ...address, name: '  Célula  ', description: ' ', postalCode: '01415000' })
    expect(args).toMatchObject({ p_name: 'Célula', p_description: null, p_weekday: 3, p_time: '20:00', p_postal_code: '01415-000', p_show_full_address: true })
  })
})
