export type BirthdayPeriod = 'today' | 'week' | 'month'

export interface BirthdayPerson {
  id: string
  fullName: string
  avatarPath: string | null
  day: number
  month: number
  /** Data (AAAA-MM-DD) em que o aniversário é comemorado dentro do período. */
  celebrationDate: string
}

export interface DateRange {
  start: string
  end: string
}

export const CHURCH_TIME_ZONE = 'America/Sao_Paulo'
export const MIN_BIRTH_DATE = '1900-01-01'
export const BIRTHDAY_PERIODS: readonly BirthdayPeriod[] = ['today', 'week', 'month']

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000
const NAME_PARTICLES = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])

export const birthdayPeriodLabels: Record<BirthdayPeriod, string> = {
  today: 'Hoje',
  week: 'Semana',
  month: 'Mês'
}

export const birthdayPeriodTitles: Record<BirthdayPeriod, string> = {
  today: 'Aniversariantes do dia',
  week: 'Aniversariantes da semana',
  month: 'Aniversariantes do mês'
}

export const birthdayEmptyMessages: Record<BirthdayPeriod, { title: string, description: string }> = {
  today: { title: 'Ninguém faz aniversário hoje', description: 'Veja quem comemora nesta semana ou neste mês.' },
  week: { title: 'Nenhum aniversariante nesta semana', description: 'De segunda a domingo não há aniversários de quem optou por receber felicitações.' },
  month: { title: 'Nenhum aniversariante neste mês', description: 'Quando alguém que optou por receber felicitações fizer aniversário, aparecerá aqui.' }
}

export function isBirthdayPeriod(value: unknown): value is BirthdayPeriod {
  return typeof value === 'string' && (BIRTHDAY_PERIODS as readonly string[]).includes(value)
}

/** Converte AAAA-MM-DD em milissegundos UTC; retorna null para datas inexistentes. */
export function parseIsoDate(value: string): number | null {
  const match = ISO_DATE.exec(value)
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const time = Date.UTC(year, month - 1, day)
  const date = new Date(time)
  const exists = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  return exists ? time : null
}

function toIsoDate(time: number) {
  return new Date(time).toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number) {
  const time = parseIsoDate(isoDate)
  if (time === null) throw new RangeError(`Data inválida: ${isoDate}`)
  return toIsoDate(time + days * DAY_MS)
}

/** Data de hoje (AAAA-MM-DD) no fuso da igreja, independente do fuso do aparelho. */
export function todayInTimeZone(now: Date = new Date(), timeZone = CHURCH_TIME_ZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

/** Hoje; semana de segunda a domingo; mês do primeiro ao último dia. */
export function birthdayPeriodRange(period: BirthdayPeriod, today: string): DateRange {
  const time = parseIsoDate(today)
  if (time === null) throw new RangeError(`Data inválida: ${today}`)
  if (period === 'today') return { start: today, end: today }
  if (period === 'week') {
    const mondayOffset = (new Date(time).getUTCDay() + 6) % 7
    const start = addDays(today, -mondayOffset)
    return { start, end: addDays(start, 6) }
  }
  const date = new Date(time)
  const start = toIsoDate(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  const end = toIsoDate(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
  return { start, end }
}

function formatUtc(time: number, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...options }).format(time)
}

/** "12 de outubro" — nunca inclui o ano de nascimento. */
export function formatDayMonth(day: number, month: number) {
  return formatUtc(Date.UTC(2000, month - 1, day), { day: 'numeric', month: 'long' })
}

function formatIsoDayMonth(isoDate: string) {
  const time = parseIsoDate(isoDate)
  return time === null ? '' : formatUtc(time, { day: 'numeric', month: 'long' })
}

/** Subtítulo do período: "28 de setembro", "28 de setembro a 4 de outubro" ou "Setembro de 2026". */
export function formatBirthdayPeriodRange(period: BirthdayPeriod, range: DateRange) {
  if (period === 'today') return formatIsoDayMonth(range.start)
  if (period === 'week') return `${formatIsoDayMonth(range.start)} a ${formatIsoDayMonth(range.end)}`
  const time = parseIsoDate(range.start)
  if (time === null) return ''
  const label = formatUtc(time, { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

/** Diferença em dias entre a comemoração e hoje (negativo = já passou). */
export function daysFromToday(celebrationDate: string, today: string) {
  const target = parseIsoDate(celebrationDate)
  const base = parseIsoDate(today)
  if (target === null || base === null) return null
  return Math.round((target - base) / DAY_MS)
}

export function relativeDayLabel(celebrationDate: string, today: string) {
  const diff = daysFromToday(celebrationDate, today)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Amanhã'
  if (diff === -1) return 'Ontem'
  return null
}

export function sortBirthdays(people: readonly BirthdayPerson[]) {
  return [...people].sort((a, b) => a.celebrationDate.localeCompare(b.celebrationDate)
    || a.fullName.localeCompare(b.fullName, 'pt-BR'))
}

function isValidDayMonth(day: unknown, month: unknown): day is number {
  return Number.isInteger(day) && Number.isInteger(month)
    && (month as number) >= 1 && (month as number) <= 12
    && (day as number) >= 1 && (day as number) <= 31
}

/** Valida as linhas da RPC list_birthdays antes de usá-las na interface. */
export function mapBirthdayRows(rows: unknown): BirthdayPerson[] {
  if (!Array.isArray(rows)) return []
  const people = rows.flatMap((row): BirthdayPerson[] => {
    if (!row || typeof row !== 'object') return []
    const item = row as Record<string, unknown>
    const valid = typeof item.id === 'string'
      && typeof item.full_name === 'string' && item.full_name.trim().length > 0
      && isValidDayMonth(item.birth_day, item.birth_month)
      && typeof item.celebration_date === 'string' && parseIsoDate(item.celebration_date) !== null
    if (!valid) return []
    return [{
      id: item.id as string,
      fullName: (item.full_name as string).trim(),
      avatarPath: typeof item.avatar_path === 'string' && item.avatar_path ? item.avatar_path : null,
      day: item.birth_day as number,
      month: item.birth_month as number,
      celebrationDate: item.celebration_date as string
    }]
  })
  return sortBirthdays(people)
}

export function initialsOf(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toLocaleUpperCase('pt-BR') || '?'
}

/** Nome curto para a arte: primeiro e último nome, ignorando "da", "de", "dos"... */
export function shortDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 2) return parts.join(' ')
  const last = [...parts].reverse().find(part => !NAME_PARTICLES.has(part.toLocaleLowerCase('pt-BR'))) ?? parts[parts.length - 1]
  return `${parts[0]} ${last}`
}

/** Data de nascimento opcional: formato válido, a partir de 1900 e não futura. */
export function validateBirthDate(value: string, today: string = todayInTimeZone()): string | undefined {
  if (!value) return undefined
  if (parseIsoDate(value) === null) return 'Informe uma data de nascimento válida.'
  if (value < MIN_BIRTH_DATE) return 'A data de nascimento deve ser a partir de 1900.'
  if (value > today) return 'A data de nascimento não pode estar no futuro.'
  return undefined
}

/** Campos de aniversário do perfil a partir do user_metadata do cadastro (dado externo). */
export function birthdayProfileFields(metadata: Record<string, unknown> | null | undefined, today: string = todayInTimeZone()) {
  const raw = metadata?.birth_date
  const birthDate = typeof raw === 'string' && raw && !validateBirthDate(raw, today) ? raw : null
  return {
    birth_date: birthDate,
    birthday_greetings_opt_in: birthDate !== null && metadata?.birthday_greetings_opt_in === true
  }
}
