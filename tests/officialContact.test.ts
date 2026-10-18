import { describe, expect, it } from 'vitest'
import { officialEmailLink, officialMapLink, officialPhoneLink, officialWhatsAppLink } from '../app/utils/officialContact'

describe('official reception channels', () => {
  it('only creates contact actions when a usable official contact exists', () => {
    expect(officialPhoneLink('')).toBe('')
    expect(officialWhatsAppLink('123')).toBe('')
    expect(officialEmailLink('email inválido')).toBe('')
    expect(officialPhoneLink('+55 (11) 99999-9999')).toBe('tel:+5511999999999')
    expect(officialWhatsAppLink('+55 (11) 99999-9999')).toBe('https://wa.me/5511999999999')
    expect(officialEmailLink(' recepcao@example.test ')).toBe('mailto:recepcao@example.test')
  })

  it('does not allow mail headers or javascript in contact actions', () => {
    expect(officialEmailLink('recepcao@example.test?bcc=other@example.test')).toBe('')
    expect(officialEmailLink('recepcao%0abcc:other@example.test')).toBe('')
    expect(officialMapLink('javascript:alert(1)', '')).toBe('')
    expect(officialMapLink('https://user:password@example.test', '')).toBe('')
  })

  it('uses a configured map or derives a search only from a published address', () => {
    expect(officialMapLink('', '')).toBe('')
    expect(officialMapLink('https://maps.app.goo.gl/exemplo', '')).toBe('https://maps.app.goo.gl/exemplo')
    const map = new URL(officialMapLink('', 'Rua de exemplo, 10 - Cidade'))
    expect(map.searchParams.get('query')).toBe('Rua de exemplo, 10 - Cidade')
    expect(map.searchParams.get('api')).toBe('1')
  })
})
