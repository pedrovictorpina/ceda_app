import type { CellLeaderProfileFormValue } from '~/types/cells'

export const LEADER_BIO_MAX = 280
export const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/
const E164_BRAZIL_PATTERN = /^55\d{10,11}$/

export type LeaderProfileErrors = Partial<Record<keyof CellLeaderProfileFormValue, string>>

/**
 * Converte um telefone digitado livremente para E.164 brasileiro somente com
 * dígitos (ex.: "(11) 99999-0000" → "5511999990000"). Vazio → ''. Inválido → null.
 */
export function normalizeBrazilianWhatsapp(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  const withCountry = /^\d{10,11}$/.test(digits) ? `55${digits}` : digits
  return E164_BRAZIL_PATTERN.test(withCountry) ? withCountry : null
}

/** "5511999990000" → "(11) 99999-0000"; mantém o valor original se não reconhecer. */
export function formatBrazilianPhone(digits: string | null | undefined): string {
  const value = digits ?? ''
  const match = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(value)
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : value
}

/** Remove @, espaços e prefixos de URL do Instagram. */
export function normalizeInstagramHandle(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/.*$/, '')
    .replace(/\?.*$/, '')
}

export function isValidInstagramHandle(handle: string): boolean {
  return INSTAGRAM_HANDLE_PATTERN.test(handle)
}

export function whatsappUrl(digits: string, text?: string): string {
  const base = `https://wa.me/${digits.replace(/\D/g, '')}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

export function instagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(normalizeInstagramHandle(handle))}`
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? ''
}

/** "Esperança" → "a célula Esperança"; "Célula Esperança" → "a Célula Esperança". */
export function cellReference(cellName: string): string {
  const name = cellName.trim()
  return /^c[ée]lula(\s|$)/i.test(name) ? `a ${name}` : `a célula ${name}`
}

/** Mensagem pronta para o visitante falar com a liderança no WhatsApp. */
export function visitGreeting(requesterName: string, cellName: string): string {
  const name = firstName(requesterName)
  const intro = name ? `Olá! Sou ${name}, vi` : 'Olá! Vi'
  return `${intro} ${cellReference(cellName)} no app da CEDA e gostaria de visitar.`
}

/** Mensagem da liderança para quem pediu visita. */
export function leaderReplyGreeting(requesterName: string, cellName: string): string {
  const name = firstName(requesterName)
  return `Olá${name ? `, ${name}` : ''}! Recebemos seu pedido para visitar ${cellReference(cellName)} pelo app da CEDA. Que alegria! Vamos combinar?`
}

export function validateLeaderProfile(input: CellLeaderProfileFormValue): LeaderProfileErrors {
  const errors: LeaderProfileErrors = {}
  if (input.bio.trim().length > LEADER_BIO_MAX) errors.bio = `Use até ${LEADER_BIO_MAX} caracteres.`
  if (normalizeBrazilianWhatsapp(input.whatsapp) === null) errors.whatsapp = 'Informe o WhatsApp com DDD, por exemplo (11) 99999-0000.'
  const handle = normalizeInstagramHandle(input.instagram)
  if (handle && !isValidInstagramHandle(handle)) errors.instagram = 'Use letras, números, ponto ou sublinhado (até 30).'
  return errors
}
