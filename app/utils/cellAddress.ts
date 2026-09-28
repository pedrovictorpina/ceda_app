import type { CellDetailsFormValue } from '~/types/cells'

export const CELL_NAME_MIN = 3
export const CELL_NAME_MAX = 80
export const CELL_DESCRIPTION_MAX = 500

export interface CellAddressParts {
  addressLine?: string
  neighborhood?: string
  city?: string
  region?: string
  postalCode?: string
}

export type CellDetailsErrors = Partial<Record<keyof CellDetailsFormValue, string>>

function clean(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/** "01415000" → "01415-000"; vazio → ''; formato inválido → null. */
export function normalizePostalCode(value: string | null | undefined): string | null {
  const digits = (value ?? '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.length === 8 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : null
}

/** "Jardim Paulista · São Paulo/SP" (partes ausentes são omitidas). */
export function cellAreaLabel(parts: CellAddressParts): string {
  const city = [clean(parts.city), clean(parts.region)].filter(Boolean).join('/')
  return [clean(parts.neighborhood), city].filter(Boolean).join(' · ')
}

/** Texto usado na busca do mapa: endereço completo quando disponível, senão bairro e cidade. */
export function cellMapsQuery(parts: CellAddressParts): string {
  return [parts.addressLine, parts.neighborhood, parts.city, parts.region, parts.postalCode]
    .map(clean)
    .filter(Boolean)
    .join(', ')
}

/** Link universal do Google Maps (abre o app no Android/iOS e o site no computador). */
export function googleMapsUrl(parts: CellAddressParts): string {
  const query = cellMapsQuery(parts)
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''
}

function hasAnyAddress(input: CellDetailsFormValue): boolean {
  return [input.addressLine, input.neighborhood, input.city, input.region, input.postalCode].some(value => clean(value))
}

function lengthError(value: string, min: number, max: number, label: string): string | undefined {
  const size = clean(value).length
  return size < min || size > max ? `Informe ${label} com ${min} a ${max} caracteres.` : undefined
}

export function validateCellDetails(input: CellDetailsFormValue): CellDetailsErrors {
  const errors: CellDetailsErrors = {
    name: lengthError(input.name, CELL_NAME_MIN, CELL_NAME_MAX, 'o nome'),
    description: clean(input.description).length > CELL_DESCRIPTION_MAX ? `Use até ${CELL_DESCRIPTION_MAX} caracteres.` : undefined,
    weekday: input.weekday !== null && (!Number.isInteger(input.weekday) || input.weekday < 0 || input.weekday > 6) ? 'Escolha um dia da semana válido.' : undefined,
    time: input.time && !/^\d{2}:\d{2}(:\d{2})?$/.test(input.time) ? 'Informe um horário válido.' : undefined
  }
  if (hasAnyAddress(input)) {
    errors.addressLine = lengthError(input.addressLine, 3, 200, 'rua e número')
    errors.neighborhood = lengthError(input.neighborhood, 2, 100, 'o bairro')
    errors.city = lengthError(input.city, 2, 100, 'a cidade')
    errors.region = lengthError(input.region, 2, 100, 'o estado')
    errors.postalCode = normalizePostalCode(input.postalCode) === null ? 'O CEP deve ter 8 dígitos.' : undefined
  }
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => Boolean(message)))
}

export function emptyCellDetailsForm(): CellDetailsFormValue {
  return {
    name: '',
    description: '',
    weekday: 3,
    time: '20:00',
    active: true,
    showFullAddress: true,
    addressLine: '',
    neighborhood: '',
    city: '',
    region: '',
    postalCode: ''
  }
}

/** Argumentos da RPC update_cell_details / create_cell_with_details. */
export function cellDetailsRpcArgs(input: CellDetailsFormValue) {
  return {
    p_name: clean(input.name),
    p_description: clean(input.description) || null,
    p_weekday: input.weekday,
    p_time: input.time || null,
    p_show_full_address: input.showFullAddress,
    p_address_line: clean(input.addressLine) || null,
    p_neighborhood: clean(input.neighborhood) || null,
    p_city: clean(input.city) || null,
    p_region: clean(input.region) || null,
    p_postal_code: normalizePostalCode(input.postalCode) || null
  }
}
