import { describe, expect, it } from 'vitest'
import {
  ageInMonths,
  ageInYears,
  birthDateBounds,
  describeNextBirthday,
  formatAgeRange,
  formatBirthday,
  formatChildAge,
  hasErrors,
  isAgeInRange,
  nextBirthday,
  parseDateOnly,
  validateChildInput,
  validateClassInput
} from '../app/utils/childAge'

const today = new Date(2026, 8, 28) // 28 de setembro de 2026

describe('child age', () => {
  it('parses calendar dates and rejects impossible ones', () => {
    expect(parseDateOnly('2020-02-29')?.getDate()).toBe(29)
    expect(parseDateOnly('2021-02-29')).toBeNull()
    expect(parseDateOnly('29/02/2020')).toBeNull()
    expect(parseDateOnly(null)).toBeNull()
  })

  it('counts completed years around the birthday', () => {
    expect(ageInYears('2021-09-28', today)).toBe(5)
    expect(ageInYears('2021-09-29', today)).toBe(4)
    expect(ageInYears('2026-10-01', today)).toBeNull()
    expect(ageInYears('', today)).toBeNull()
  })

  it('treats a leap-day birthday as 28 February in common years', () => {
    expect(ageInYears('2020-02-29', new Date(2025, 1, 28))).toBe(5)
    expect(ageInYears('2020-02-29', new Date(2025, 1, 27))).toBe(4)
  })

  it('counts months for babies', () => {
    expect(ageInMonths('2026-01-28', today)).toBe(8)
    expect(ageInMonths('2026-01-29', today)).toBe(7)
  })

  it('formats ages in Portuguese', () => {
    expect(formatChildAge('2026-09-20', today)).toBe('Recém-nascido')
    expect(formatChildAge('2026-08-20', today)).toBe('1 mês')
    expect(formatChildAge('2026-01-10', today)).toBe('8 meses')
    expect(formatChildAge('2025-09-01', today)).toBe('1 ano')
    expect(formatChildAge('2019-03-15', today)).toBe('7 anos')
    expect(formatChildAge(null, today)).toBe('Idade não informada')
  })
})

describe('next birthday', () => {
  it('finds the birthday later this year', () => {
    expect(nextBirthday('2020-10-03', today)).toMatchObject({ daysUntil: 5, turning: 6 })
  })

  it('rolls over to next year when the date already passed', () => {
    const next = nextBirthday('2020-03-15', today)
    expect(next?.date.getFullYear()).toBe(2027)
    expect(next?.turning).toBe(7)
  })

  it('describes today, tomorrow and later dates', () => {
    expect(describeNextBirthday('2021-09-28', today)).toBe('Faz 5 anos hoje!')
    expect(describeNextBirthday('2025-09-29', today)).toBe('Faz 1 ano amanhã')
    expect(describeNextBirthday('2020-10-03', today)).toBe('Faz 6 anos em 5 dias (3 de outubro)')
    expect(describeNextBirthday('invalid', today)).toBe('')
  })

  it('formats day and month', () => {
    expect(formatBirthday('2020-12-25')).toBe('25 de dezembro')
    expect(formatBirthday(null)).toBe('')
  })
})

describe('class age range', () => {
  it('checks inclusive ranges', () => {
    expect(isAgeInRange(3, 3, 5)).toBe(true)
    expect(isAgeInRange(5, 3, 5)).toBe(true)
    expect(isAgeInRange(6, 3, 5)).toBe(false)
    expect(isAgeInRange(null, 0, 17)).toBe(false)
  })

  it('describes the range', () => {
    expect(formatAgeRange(3, 5)).toBe('de 3 a 5 anos')
    expect(formatAgeRange(0, 1)).toBe('de 0 a 1 ano')
    expect(formatAgeRange(4, 4)).toBe('4 anos')
    expect(formatAgeRange(1, 1)).toBe('1 ano')
  })
})

describe('form validation', () => {
  it('limits birth dates to the last 17 years', () => {
    expect(birthDateBounds(today)).toEqual({ min: '2008-09-29', max: '2026-09-28' })
  })

  it('accepts a valid child', () => {
    expect(validateChildInput({ fullName: 'Ana Clara', birthDate: '2020-05-10', allergies: '' }, today)).toEqual({})
  })

  it('reports invalid child fields', () => {
    const errors = validateChildInput({ fullName: ' A ', birthDate: '2026-10-01', allergies: 'x'.repeat(301) }, today)
    expect(errors.fullName).toBeDefined()
    expect(errors.birthDate).toBe('A data de nascimento não pode estar no futuro.')
    expect(errors.allergies).toBeDefined()
    expect(hasErrors(errors)).toBe(true)
    expect(validateChildInput({ fullName: 'Ana', birthDate: '2008-09-28', allergies: '' }, today).birthDate)
      .toBe('O Sementinhas atende crianças de até 17 anos.')
    expect(validateChildInput({ fullName: 'Ana', birthDate: '', allergies: '' }, today).birthDate)
      .toBe('Informe a data de nascimento.')
  })

  it('validates class ranges and text', () => {
    expect(validateClassInput({ name: 'Jardim', minAge: 3, maxAge: 5, room: 'Sala 2', notes: '' })).toEqual({})
    expect(validateClassInput({ name: 'Jardim', minAge: 6, maxAge: 5, room: '', notes: '' }).maxAge)
      .toBe('A idade máxima deve ser maior ou igual à mínima.')
    expect(validateClassInput({ name: 'J', minAge: -1, maxAge: 18, room: '', notes: '' })).toMatchObject({
      name: expect.any(String),
      minAge: expect.any(String),
      maxAge: expect.any(String)
    })
    expect(validateClassInput({ name: 'Jardim', minAge: 2.5, maxAge: 5, room: '', notes: '' }).minAge).toBeDefined()
  })
})
