import { validateBirthDate } from './birthdays'

export interface RegistrationInput {
  fullName: string
  email: string
  phone: string
  password: string
  passwordConfirmation: string
  acceptedPrivacy: boolean
  /** Opcional (AAAA-MM-DD). */
  birthDate: string
  /** Consentimento para aparecer nos aniversariantes; desmarcado por padrão. */
  birthdayGreetingsOptIn: boolean
}

export type RegistrationErrors = Partial<Record<keyof RegistrationInput, string>>

export function validateRegistration(input: RegistrationInput): RegistrationErrors {
  const errors: RegistrationErrors = {}
  if (input.fullName.trim().length < 2) errors.fullName = 'Informe seu nome completo.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = 'Informe um e-mail válido.'
  if (input.phone.trim() && !/^[+\d][\d\s().-]{7,19}$/.test(input.phone.trim())) errors.phone = 'Informe um telefone válido.'
  if (input.password.length < 8 || !/[a-z]/.test(input.password) || !/[A-Z]/.test(input.password) || !/\d/.test(input.password)) {
    errors.password = 'Use ao menos 8 caracteres, com maiúscula, minúscula e número.'
  }
  if (!input.passwordConfirmation) errors.passwordConfirmation = 'Confirme sua senha.'
  else if (input.passwordConfirmation !== input.password) errors.passwordConfirmation = 'As senhas não coincidem.'
  const birthDateError = validateBirthDate(input.birthDate)
  if (birthDateError) errors.birthDate = birthDateError
  else if (input.birthdayGreetingsOptIn && !input.birthDate) errors.birthDate = 'Informe sua data de nascimento para receber felicitações.'
  if (!input.acceptedPrivacy) errors.acceptedPrivacy = 'Você precisa aceitar a Política de Privacidade.'
  return errors
}
