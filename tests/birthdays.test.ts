import { describe, expect, it } from 'vitest'
import {
  birthdayPeriodRange,
  birthdayProfileFields,
  daysFromToday,
  formatBirthdayPeriodRange,
  formatDayMonth,
  initialsOf,
  isBirthdayPeriod,
  mapBirthdayRows,
  parseIsoDate,
  relativeDayLabel,
  shortDisplayName,
  sortBirthdays,
  todayInTimeZone,
  validateBirthDate,
  type BirthdayPerson
} from '../app/utils/birthdays'

const person = (overrides: Partial<BirthdayPerson>): BirthdayPerson => ({
  id: 'id',
  fullName: 'Pessoa',
  avatarPath: null,
  day: 1,
  month: 1,
  celebrationDate: '2026-01-01',
  ...overrides
})

describe('birthday dates', () => {
  it('computes today in the church time zone, not the device time zone', () => {
    // 01:30 UTC ainda é o dia anterior em São Paulo (UTC-3).
    expect(todayInTimeZone(new Date('2026-10-13T01:30:00Z'))).toBe('2026-10-12')
    expect(todayInTimeZone(new Date('2026-10-13T03:30:00Z'))).toBe('2026-10-13')
  })

  it('rejects dates that do not exist', () => {
    expect(parseIsoDate('2027-02-29')).toBeNull()
    expect(parseIsoDate('2028-02-29')).not.toBeNull()
    expect(parseIsoDate('12/10/2026')).toBeNull()
  })

  it('builds a Monday to Sunday week, including across the year', () => {
    expect(birthdayPeriodRange('week', '2026-09-28')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
    expect(birthdayPeriodRange('week', '2026-10-04')).toEqual({ start: '2026-09-28', end: '2026-10-04' })
    expect(birthdayPeriodRange('week', '2026-12-31')).toEqual({ start: '2026-12-28', end: '2027-01-03' })
  })

  it('builds today and whole-month ranges', () => {
    expect(birthdayPeriodRange('today', '2026-09-28')).toEqual({ start: '2026-09-28', end: '2026-09-28' })
    expect(birthdayPeriodRange('month', '2027-02-15')).toEqual({ start: '2027-02-01', end: '2027-02-28' })
    expect(birthdayPeriodRange('month', '2028-02-15')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('formats day and month without the birth year', () => {
    expect(formatDayMonth(12, 10)).toBe('12 de outubro')
    expect(formatDayMonth(29, 2)).toBe('29 de fevereiro')
  })

  it('formats the period subtitle', () => {
    expect(formatBirthdayPeriodRange('today', birthdayPeriodRange('today', '2026-09-28'))).toBe('28 de setembro')
    expect(formatBirthdayPeriodRange('week', birthdayPeriodRange('week', '2026-09-30'))).toBe('28 de setembro a 4 de outubro')
    expect(formatBirthdayPeriodRange('month', birthdayPeriodRange('month', '2026-09-30'))).toBe('Setembro de 2026')
  })

  it('labels relative days', () => {
    expect(relativeDayLabel('2026-09-28', '2026-09-28')).toBe('Hoje')
    expect(relativeDayLabel('2026-09-29', '2026-09-28')).toBe('Amanhã')
    expect(relativeDayLabel('2026-09-27', '2026-09-28')).toBe('Ontem')
    expect(relativeDayLabel('2026-10-02', '2026-09-28')).toBeNull()
    expect(daysFromToday('2027-01-02', '2026-12-31')).toBe(2)
  })

  it('validates optional birth dates', () => {
    expect(validateBirthDate('', '2026-09-28')).toBeUndefined()
    expect(validateBirthDate('1990-05-10', '2026-09-28')).toBeUndefined()
    expect(validateBirthDate('2026-09-28', '2026-09-28')).toBeUndefined()
    expect(validateBirthDate('2026-09-29', '2026-09-28')).toMatch(/futuro/)
    expect(validateBirthDate('1899-12-31', '2026-09-28')).toMatch(/1900/)
    expect(validateBirthDate('2026-02-30', '2026-09-28')).toMatch(/válida/)
  })

  it('recognizes only supported periods', () => {
    expect(isBirthdayPeriod('week')).toBe(true)
    expect(isBirthdayPeriod('year')).toBe(false)
    expect(isBirthdayPeriod(undefined)).toBe(false)
  })
})

describe('birthday people', () => {
  it('maps valid RPC rows, drops malformed ones and sorts by day', () => {
    const rows = [
      { id: 'b', full_name: ' Bruno ', avatar_path: '', birth_day: 2, birth_month: 1, celebration_date: '2027-01-02' },
      { id: 'a', full_name: 'Ana', avatar_path: 'a/avatar', birth_day: 30, birth_month: 12, celebration_date: '2026-12-30' },
      { id: 'x', full_name: '', birth_day: 1, birth_month: 1, celebration_date: '2027-01-01' },
      { id: 'y', full_name: 'Sem data', birth_day: 40, birth_month: 1, celebration_date: '2027-01-01' },
      null
    ]
    expect(mapBirthdayRows(rows)).toEqual([
      { id: 'a', fullName: 'Ana', avatarPath: 'a/avatar', day: 30, month: 12, celebrationDate: '2026-12-30' },
      { id: 'b', fullName: 'Bruno', avatarPath: null, day: 2, month: 1, celebrationDate: '2027-01-02' }
    ])
    expect(mapBirthdayRows('invalid')).toEqual([])
  })

  it('sorts by celebration date then name without mutating the input', () => {
    const input = [
      person({ id: '1', fullName: 'Zé', celebrationDate: '2026-10-01' }),
      person({ id: '2', fullName: 'Ângela', celebrationDate: '2026-10-01' }),
      person({ id: '3', fullName: 'Bia', celebrationDate: '2026-09-30' })
    ]
    expect(sortBirthdays(input).map(item => item.id)).toEqual(['3', '2', '1'])
    expect(input[0]?.id).toBe('1')
  })

  it('builds initials and short display names', () => {
    expect(initialsOf('maria aparecida da silva')).toBe('MS')
    expect(initialsOf('João')).toBe('J')
    expect(initialsOf('   ')).toBe('?')
    expect(shortDisplayName('Maria Aparecida da Silva')).toBe('Maria Silva')
    expect(shortDisplayName('Ana dos')).toBe('Ana dos')
    expect(shortDisplayName('José Carlos de Souza dos')).toBe('José Souza')
  })
})

describe('birthday signup metadata', () => {
  it('accepts a valid date and explicit consent only', () => {
    expect(birthdayProfileFields({ birth_date: '1990-10-12', birthday_greetings_opt_in: true }, '2026-09-28'))
      .toEqual({ birth_date: '1990-10-12', birthday_greetings_opt_in: true })
    expect(birthdayProfileFields({ birth_date: '1990-10-12', birthday_greetings_opt_in: 'true' }, '2026-09-28'))
      .toEqual({ birth_date: '1990-10-12', birthday_greetings_opt_in: false })
  })

  it('discards invalid dates and consent without a date', () => {
    expect(birthdayProfileFields({ birth_date: '2999-01-01', birthday_greetings_opt_in: true }, '2026-09-28'))
      .toEqual({ birth_date: null, birthday_greetings_opt_in: false })
    expect(birthdayProfileFields({ birth_date: 19901012 }, '2026-09-28')).toEqual({ birth_date: null, birthday_greetings_opt_in: false })
    expect(birthdayProfileFields(undefined, '2026-09-28')).toEqual({ birth_date: null, birthday_greetings_opt_in: false })
  })
})
