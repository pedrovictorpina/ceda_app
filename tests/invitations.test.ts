import { describe, expect, it } from 'vitest'
import { buildRegistrationInvitationUrl, invitationDescription, isRegistrationInvitation } from '../app/utils/invitations'

describe('registration invitations', () => {
  it('builds a fixed production registration invitation link without personal data', () => {
    expect(buildRegistrationInvitationUrl()).toBe('https://ceda-app-beige.vercel.app/cadastro?convite=ceda')
  })

  it('marks family invitations as attribution only', () => {
    expect(buildRegistrationInvitationUrl('family')).toBe('https://ceda-app-beige.vercel.app/cadastro?convite=ceda&origem=familia')
    expect(invitationDescription('family')).toContain('família')
  })

  it('recognizes only the CEDA invitation code', () => {
    expect(isRegistrationInvitation({ convite: 'ceda' })).toBe(true)
    expect(isRegistrationInvitation({ convite: 'alterado' })).toBe(false)
    expect(isRegistrationInvitation({})).toBe(false)
  })
})
