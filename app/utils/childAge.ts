import type { ChildFormValue, ClassFormValue } from '~/types/children'

export const MAX_CHILD_AGE = 17
export const CHILD_NAME_MIN = 2
export const CHILD_NAME_MAX = 120
export const CHILD_ALLERGIES_MAX = 300
export const CLASS_NAME_MAX = 80
export const CLASS_ROOM_MAX = 80
export const CLASS_NOTES_MAX = 500

const DAY_MS = 24 * 60 * 60 * 1000
const dayMonthFormatter = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long' })

/** Lê uma data "AAAA-MM-DD" como data de calendário local (sem fuso). */
export function parseDateOnly(value: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(year, month - 1, day)
  const sameDay = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return sameDay ? date : null
}

export function toDateKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Aniversário em um ano específico; 29/02 vira 28/02 em anos não bissextos. */
function birthdayInYear(birth: Date, year: number) {
  const candidate = new Date(year, birth.getMonth(), birth.getDate())
  return candidate.getMonth() === birth.getMonth() ? candidate : new Date(year, birth.getMonth() + 1, 0)
}

export function ageInYears(birthDate: string | null | undefined, today = new Date()): number | null {
  const birth = parseDateOnly(birthDate)
  if (!birth) return null
  const reference = startOfDay(today)
  if (birth > reference) return null
  const hadBirthday = birthdayInYear(birth, reference.getFullYear()) <= reference
  return reference.getFullYear() - birth.getFullYear() - (hadBirthday ? 0 : 1)
}

export function ageInMonths(birthDate: string | null | undefined, today = new Date()): number | null {
  const birth = parseDateOnly(birthDate)
  if (!birth) return null
  const reference = startOfDay(today)
  if (birth > reference) return null
  const months = (reference.getFullYear() - birth.getFullYear()) * 12 + reference.getMonth() - birth.getMonth()
  return reference.getDate() < birth.getDate() ? months - 1 : months
}

/** "Recém-nascido", "1 mês", "8 meses", "1 ano", "5 anos". */
export function formatChildAge(birthDate: string | null | undefined, today = new Date()): string {
  const years = ageInYears(birthDate, today)
  if (years === null) return 'Idade não informada'
  if (years >= 1) return years === 1 ? '1 ano' : `${years} anos`
  const months = ageInMonths(birthDate, today) ?? 0
  if (months === 0) return 'Recém-nascido'
  return months === 1 ? '1 mês' : `${months} meses`
}

export function formatBirthday(birthDate: string | null | undefined): string {
  const birth = parseDateOnly(birthDate)
  return birth ? dayMonthFormatter.format(birth) : ''
}

export interface NextBirthday {
  date: Date
  daysUntil: number
  turning: number
}

export function nextBirthday(birthDate: string | null | undefined, today = new Date()): NextBirthday | null {
  const birth = parseDateOnly(birthDate)
  if (!birth) return null
  const reference = startOfDay(today)
  if (birth > reference) return null
  const thisYear = birthdayInYear(birth, reference.getFullYear())
  const date = thisYear >= reference ? thisYear : birthdayInYear(birth, reference.getFullYear() + 1)
  return {
    date,
    daysUntil: Math.round((date.getTime() - reference.getTime()) / DAY_MS),
    turning: date.getFullYear() - birth.getFullYear()
  }
}

/** "Faz 5 anos hoje!", "Faz 5 anos amanhã", "Faz 5 anos em 12 dias (15 de março)". */
export function describeNextBirthday(birthDate: string | null | undefined, today = new Date()): string {
  const next = nextBirthday(birthDate, today)
  if (!next) return ''
  const turning = next.turning === 1 ? '1 ano' : `${next.turning} anos`
  if (next.daysUntil === 0) return `Faz ${turning} hoje!`
  if (next.daysUntil === 1) return `Faz ${turning} amanhã`
  return `Faz ${turning} em ${next.daysUntil} dias (${dayMonthFormatter.format(next.date)})`
}

export function isAgeInRange(age: number | null, minAge: number, maxAge: number): boolean {
  return age !== null && age >= minAge && age <= maxAge
}

/** Descrição da turma: "de 3 a 5 anos", "de 0 a 1 ano", "4 anos". */
export function formatAgeRange(minAge: number, maxAge: number): string {
  const unit = maxAge === 1 ? 'ano' : 'anos'
  if (minAge === maxAge) return `${maxAge} ${unit}`
  return `de ${minAge} a ${maxAge} ${unit}`
}

/** Limites do campo de nascimento: até hoje e no máximo 17 anos completos. */
export function birthDateBounds(today = new Date()) {
  const reference = startOfDay(today)
  const earliest = new Date(reference.getFullYear() - (MAX_CHILD_AGE + 1), reference.getMonth(), reference.getDate() + 1)
  return { min: toDateKey(earliest), max: toDateKey(reference) }
}

export type ChildFormErrors = Partial<Record<keyof ChildFormValue, string>>
export type ClassFormErrors = Partial<Record<keyof ClassFormValue, string>>

export function validateChildInput(input: ChildFormValue, today = new Date()): ChildFormErrors {
  const errors: ChildFormErrors = {}
  const name = input.fullName.trim()
  if (name.length < CHILD_NAME_MIN || name.length > CHILD_NAME_MAX) {
    errors.fullName = `Informe o nome com ${CHILD_NAME_MIN} a ${CHILD_NAME_MAX} caracteres.`
  }
  const birth = parseDateOnly(input.birthDate)
  const bounds = birthDateBounds(today)
  if (!birth) errors.birthDate = 'Informe a data de nascimento.'
  else if (input.birthDate > bounds.max) errors.birthDate = 'A data de nascimento não pode estar no futuro.'
  else if (input.birthDate < bounds.min) errors.birthDate = `O Sementinhas atende crianças de até ${MAX_CHILD_AGE} anos.`
  if (input.allergies.trim().length > CHILD_ALLERGIES_MAX) {
    errors.allergies = `Use até ${CHILD_ALLERGIES_MAX} caracteres.`
  }
  return errors
}

function isWholeAge(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_CHILD_AGE
}

export function validateClassInput(input: ClassFormValue): ClassFormErrors {
  const errors: ClassFormErrors = {}
  const name = input.name.trim()
  if (name.length < 2 || name.length > CLASS_NAME_MAX) errors.name = `Informe o nome com 2 a ${CLASS_NAME_MAX} caracteres.`
  if (!isWholeAge(input.minAge)) errors.minAge = `Use uma idade de 0 a ${MAX_CHILD_AGE}.`
  if (!isWholeAge(input.maxAge)) errors.maxAge = `Use uma idade de 0 a ${MAX_CHILD_AGE}.`
  else if (!errors.minAge && input.minAge > input.maxAge) errors.maxAge = 'A idade máxima deve ser maior ou igual à mínima.'
  if (input.room.trim().length > CLASS_ROOM_MAX) errors.room = `Use até ${CLASS_ROOM_MAX} caracteres.`
  if (input.notes.trim().length > CLASS_NOTES_MAX) errors.notes = `Use até ${CLASS_NOTES_MAX} caracteres.`
  return errors
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some(Boolean)
}
