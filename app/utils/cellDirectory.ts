import type {
  CellDirectoryEntry,
  CellDirectoryFilters,
  CellLeaderProfile,
  CellMemberCandidate,
  CellRelationship,
  CellVisitFormValue,
  CellVisitRequest,
  CellVisitRequestSummary,
  CellVisitStatus
} from '~/types/cells'
import { friendlyDatabaseError } from './databaseErrors'

export const VISIT_MESSAGE_MAX = 500
export const VISIT_MAX_DAYS_AHEAD = 180
export const MEMBER_SEARCH_MIN = 2

const WEEKDAY_PLURALS = ['Domingos', 'Segundas', 'Terças', 'Quartas', 'Quintas', 'Sextas', 'Sábados'] as const
export const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

export const VISIT_STATUS_LABELS: Record<CellVisitStatus, string> = {
  pending: 'Aguardando contato',
  contacted: 'Liderança entrou em contato',
  closed: 'Encerrado'
}

type Row = Record<string, unknown>

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function isRow(value: unknown): value is Row {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isVisitStatus(value: unknown): value is CellVisitStatus {
  return value === 'pending' || value === 'contacted' || value === 'closed'
}

function isRelationship(value: unknown): value is CellRelationship {
  return value === 'leader' || value === 'member' || value === 'manager'
}

/** "Quintas, 20h" / "Quartas, 19h30"; sem dia → "Dia a definir". */
export function cellShortScheduleLabel(weekday?: number | null, time?: string | null): string {
  const day = weekday === undefined || weekday === null ? undefined : WEEKDAY_PLURALS[weekday]
  const match = /^(\d{2}):(\d{2})/.exec(time ?? '')
  const hour = match ? `${Number(match[1])}h${match[2] === '00' ? '' : match[2]}` : ''
  if (!day) return hour ? `Dia a definir, ${hour}` : 'Dia a definir'
  return hour ? `${day}, ${hour}` : day
}

export function mapLeaderRows(value: unknown): CellLeaderProfile[] {
  if (!Array.isArray(value)) return []
  return value.filter(isRow).flatMap((row) => {
    const userId = text(row.user_id)
    if (!userId) return []
    return [{
      userId,
      name: text(row.full_name) ?? 'Líder',
      avatarPath: text(row.avatar_path),
      bio: text(row.bio),
      whatsapp: text(row.whatsapp),
      instagram: text(row.instagram)
    }]
  })
}

function mapVisitSummary(value: unknown): CellVisitRequestSummary | undefined {
  if (!isRow(value) || !text(value.id) || !isVisitStatus(value.status)) return undefined
  return {
    id: value.id as string,
    status: value.status,
    createdAt: text(value.created_at) ?? '',
    preferredDate: text(value.preferred_date)
  }
}

/** Linhas da RPC list_cell_directory → entradas tipadas (ignora linhas malformadas). */
export function mapDirectoryRows(data: unknown): CellDirectoryEntry[] {
  if (!Array.isArray(data)) return []
  return data.filter(isRow).flatMap((row) => {
    const id = text(row.cell_id)
    const name = text(row.name)
    if (!id || !name) return []
    return [{
      id,
      name,
      description: text(row.description),
      meetingWeekday: typeof row.meeting_weekday === 'number' ? row.meeting_weekday : undefined,
      meetingTime: text(row.meeting_time),
      neighborhood: text(row.neighborhood),
      city: text(row.city),
      region: text(row.region),
      addressLine: text(row.address_line),
      postalCode: text(row.postal_code),
      fullAddressVisible: row.full_address_visible === true,
      showFullAddress: row.show_full_address !== false,
      relationship: isRelationship(row.relationship) ? row.relationship : null,
      leaders: mapLeaderRows(row.leaders),
      myVisitRequest: mapVisitSummary(row.my_visit_request)
    }]
  })
}

export function mapVisitRequestRows(data: unknown): CellVisitRequest[] {
  if (!Array.isArray(data)) return []
  return data.filter(isRow).flatMap((row) => {
    const id = text(row.id)
    const requesterId = text(row.requester_id)
    if (!id || !requesterId || !isVisitStatus(row.status)) return []
    return [{
      id,
      requesterId,
      requesterName: text(row.requester_name) ?? 'Pessoa sem nome',
      requesterAvatarPath: text(row.requester_avatar_path),
      requesterPhone: text(row.requester_phone),
      message: text(row.message),
      preferredDate: text(row.preferred_date),
      status: row.status,
      createdAt: text(row.created_at) ?? '',
      handledAt: text(row.handled_at),
      handledByName: text(row.handled_by_name)
    }]
  })
}

export function mapMemberCandidates(data: unknown): CellMemberCandidate[] {
  if (!Array.isArray(data)) return []
  return data.filter(isRow).flatMap((row) => {
    const id = text(row.id)
    return id ? [{ id, name: text(row.full_name) ?? 'Pessoa sem nome', avatarPath: text(row.avatar_path) }] : []
  })
}

/** Minúsculas sem acentos (espelha private.fold_text no banco). */
export function foldText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

export function filterCellDirectory(entries: readonly CellDirectoryEntry[], filters: CellDirectoryFilters): CellDirectoryEntry[] {
  const needle = foldText(filters.search)
  return entries.filter((entry) => {
    if (filters.weekday !== null && entry.meetingWeekday !== filters.weekday) return false
    if (!needle) return true
    return [entry.name, entry.neighborhood, entry.city, ...entry.leaders.map(leader => leader.name)]
      .some(value => foldText(value).includes(needle))
  })
}

/** "Ana e Bruno" / "Ana, Bruno e Carla". */
export function leaderNames(leaders: readonly CellLeaderProfile[]): string {
  const names = leaders.map(leader => leader.name.trim().split(/\s+/)[0]).filter(Boolean)
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
}

/** Primeira linha do primeiro resumo preenchido, limitada para caber no card. */
export function leadersTeaser(leaders: readonly CellLeaderProfile[], maxLength = 110): string {
  const bio = leaders.map(leader => leader.bio?.split(/\r?\n/)[0]?.trim()).find(Boolean) ?? ''
  return bio.length > maxLength ? `${bio.slice(0, maxLength - 1).trimEnd()}…` : bio
}

export function canRequestVisit(entry: CellDirectoryEntry): boolean {
  if (entry.relationship === 'leader' || entry.relationship === 'member') return false
  return !entry.myVisitRequest || entry.myVisitRequest.status === 'closed'
}

export function firstLeaderWithWhatsapp(leaders: readonly CellLeaderProfile[]): CellLeaderProfile | undefined {
  return leaders.find(leader => Boolean(leader.whatsapp))
}

export type VisitFormErrors = Partial<Record<keyof CellVisitFormValue, string>>

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1) + days))
  return date.toISOString().slice(0, 10)
}

export function validateVisitForm(input: CellVisitFormValue, todayKey: string): VisitFormErrors {
  const errors: VisitFormErrors = {}
  if (input.message.trim().length > VISIT_MESSAGE_MAX) errors.message = `Use até ${VISIT_MESSAGE_MAX} caracteres.`
  if (input.preferredDate) {
    const valid = /^\d{4}-\d{2}-\d{2}$/.test(input.preferredDate)
    if (!valid || input.preferredDate < todayKey || input.preferredDate > addDays(todayKey, VISIT_MAX_DAYS_AHEAD)) {
      errors.preferredDate = 'Escolha uma data a partir de hoje e em até 6 meses.'
    }
  }
  return errors
}

/** Mensagem segura: textos escritos pelo app ou pelas RPCs; erros técnicos viram a contingência. */
export function cellErrorMessage(error: unknown, fallback: string): string {
  if (isRow(error) && typeof error.code === 'string') {
    return friendlyDatabaseError({ code: error.code, message: typeof error.message === 'string' ? error.message : '' }, fallback)
  }
  return error instanceof Error && error.message ? error.message : fallback
}

export function formatDateKey(dateKey: string | undefined): string {
  if (!dateKey) return ''
  const [year, month, day] = dateKey.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : ''
}
