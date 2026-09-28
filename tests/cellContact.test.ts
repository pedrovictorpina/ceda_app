import { describe, expect, it } from 'vitest'
import {
  firstName,
  formatBrazilianPhone,
  instagramUrl,
  isValidInstagramHandle,
  leaderReplyGreeting,
  normalizeBrazilianWhatsapp,
  normalizeInstagramHandle,
  validateLeaderProfile,
  visitGreeting,
  whatsappUrl
} from '../app/utils/cellContact'

describe('WhatsApp helpers', () => {
  it('normalizes Brazilian numbers to E.164 digits', () => {
    expect(normalizeBrazilianWhatsapp('(11) 99999-0000')).toBe('5511999990000')
    expect(normalizeBrazilianWhatsapp('+55 11 3333-4444')).toBe('551133334444')
    expect(normalizeBrazilianWhatsapp('5511999990000')).toBe('5511999990000')
    expect(normalizeBrazilianWhatsapp('')).toBe('')
    expect(normalizeBrazilianWhatsapp('   ')).toBe('')
  })

  it('rejects numbers that are not Brazilian mobile or landline', () => {
    expect(normalizeBrazilianWhatsapp('12345')).toBeNull()
    expect(normalizeBrazilianWhatsapp('+1 415 555 0000 00')).toBeNull()
    expect(normalizeBrazilianWhatsapp('4415555000011')).toBeNull()
  })

  it('formats stored digits for display', () => {
    expect(formatBrazilianPhone('5511999990000')).toBe('(11) 99999-0000')
    expect(formatBrazilianPhone('551133334444')).toBe('(11) 3333-4444')
    expect(formatBrazilianPhone('abc')).toBe('abc')
  })

  it('builds wa.me links with an encoded message', () => {
    expect(whatsappUrl('5511999990000')).toBe('https://wa.me/5511999990000')
    expect(whatsappUrl('5511999990000', 'Olá! Tudo bem?')).toBe('https://wa.me/5511999990000?text=Ol%C3%A1!%20Tudo%20bem%3F')
  })

  it('writes the visit greetings with the first name', () => {
    expect(visitGreeting('João da Silva', 'Célula Esperança ')).toBe('Olá! Sou João, vi a Célula Esperança no app da CEDA e gostaria de visitar.')
    expect(visitGreeting('', 'Graça')).toBe('Olá! Vi a célula Graça no app da CEDA e gostaria de visitar.')
    expect(leaderReplyGreeting('Maria Souza', 'Graça')).toContain('Olá, Maria!')
    expect(firstName('  Ana   Paula ')).toBe('Ana')
  })
})

describe('Instagram helpers', () => {
  it('strips @, URLs and query strings', () => {
    expect(normalizeInstagramHandle('@ana.lider')).toBe('ana.lider')
    expect(normalizeInstagramHandle('https://www.instagram.com/ana_lider/?hl=pt')).toBe('ana_lider')
    expect(normalizeInstagramHandle('  ana  ')).toBe('ana')
  })

  it('validates the handle format', () => {
    expect(isValidInstagramHandle('ana.lider_2')).toBe(true)
    expect(isValidInstagramHandle('ana lider')).toBe(false)
    expect(isValidInstagramHandle('a'.repeat(31))).toBe(false)
  })

  it('builds the profile link', () => {
    expect(instagramUrl('@ana.lider')).toBe('https://instagram.com/ana.lider')
  })
})

describe('validateLeaderProfile', () => {
  it('accepts an empty profile and a complete one', () => {
    expect(validateLeaderProfile({ bio: '', whatsapp: '', instagram: '' })).toEqual({})
    expect(validateLeaderProfile({ bio: 'Casados há 10 anos.', whatsapp: '(11) 99999-0000', instagram: '@ana' })).toEqual({})
  })

  it('reports each invalid field', () => {
    const errors = validateLeaderProfile({ bio: 'x'.repeat(281), whatsapp: '123', instagram: 'ana lider' })
    expect(Object.keys(errors).sort()).toEqual(['bio', 'instagram', 'whatsapp'])
  })
})
