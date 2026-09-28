export const INVITATION_CODE = 'ceda'
export const INVITATION_PRODUCTION_ORIGIN = 'https://ceda-app-beige.vercel.app'

export type InvitationSource = 'general' | 'family'

export function buildRegistrationInvitationUrl(source: InvitationSource = 'general') {
  const url = new URL('/cadastro', INVITATION_PRODUCTION_ORIGIN)
  url.searchParams.set('convite', INVITATION_CODE)
  if (source === 'family') url.searchParams.set('origem', 'familia')
  return url.toString()
}

export function isRegistrationInvitation(query: Record<string, unknown>) {
  return query.convite === INVITATION_CODE
}

export function invitationDescription(source: InvitationSource) {
  return source === 'family'
    ? 'Você foi convidado por alguém da família CEDA. Complete seu cadastro para entrar na comunidade.'
    : 'Você foi convidado para fazer parte da CEDA. Complete seu cadastro para entrar na comunidade.'
}
