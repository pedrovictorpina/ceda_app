import { describe, expect, it } from 'vitest'
import { validateRegistration, type RegistrationInput } from '../app/utils/registration'

const valid: RegistrationInput = {
  fullName: 'Pessoa Teste',
  email: 'pessoa@example.test',
  phone: '+55 11 99999-9999',
  password: 'Senha123',
  passwordConfirmation: 'Senha123',
  acceptedPrivacy: true
}

describe('registration validation', () => {
  it('accepts a complete valid registration', () => {
    expect(validateRegistration(valid)).toEqual({})
  })

  it('requires identity, valid email, strong password, confirmation and privacy acceptance', () => {
    const errors = validateRegistration({ ...valid, fullName: '', email: 'invalid', password: 'weak', passwordConfirmation: 'other', acceptedPrivacy: false })
    expect(errors).toMatchObject({
      fullName: expect.any(String),
      email: expect.any(String),
      password: expect.any(String),
      passwordConfirmation: expect.any(String),
      acceptedPrivacy: expect.any(String)
    })
  })

  it('requires an explicit password confirmation', () => {
    expect(validateRegistration({ ...valid, passwordConfirmation: '' }).passwordConfirmation).toBe('Confirme sua senha.')
  })

  it('keeps phone optional but validates it when present', () => {
    expect(validateRegistration({ ...valid, phone: '' }).phone).toBeUndefined()
    expect(validateRegistration({ ...valid, phone: 'abc' }).phone).toBeDefined()
  })
})
