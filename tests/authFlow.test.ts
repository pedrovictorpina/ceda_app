import { describe, expect, it } from 'vitest'
import { authErrorMessage, authFlowLink, safeAuthReturnTo, validateAuthEmail, validatePasswordChange } from '../app/utils/authFlow'

describe('continuity after authentication', () => {
  it('keeps the intended task, filters and anchor through each auth page', () => {
    const destination = '/celulas/grupo-123?aba=visita#pedido'
    expect(safeAuthReturnTo(destination)).toBe(destination)
    for (const path of ['/entrar', '/cadastro', '/recuperar-senha', '/redefinir-senha'] as const) {
      const url = new URL(authFlowLink(path, destination), 'https://ceda.invalid')
      expect(url.pathname).toBe(path)
      expect(url.searchParams.get('next')).toBe(destination)
    }
    expect(safeAuthReturnTo('/oracao')).toBe('/oracao')
    expect(safeAuthReturnTo('/salvos')).toBe('/salvos')
    expect(safeAuthReturnTo('/admin/pessoas')).toBe('/admin/pessoas')
  })

  it.each([
    'https://evil.example/oracao', '//evil.example/oracao', '/\\evil.example',
    'javascript:alert(1)', '/%2f%2fevil.example', '/celulas/%2f%2fevil.example',
    '/entrar?next=/oracao', '/cadastro', '/recuperar-senha', '/redefinir-senha',
    '/api/admin/roles', '/pagina-inexistente', '/inicio\n', '/%ZZ'
  ])('rejects an external, unknown, server or looping destination: %s', (destination) => {
    expect(safeAuthReturnTo(destination)).toBe('/inicio')
  })

  it('does not accept ambiguous repeated query values', () => {
    expect(safeAuthReturnTo(['/oracao', 'https://evil.example'])).toBe('/inicio')
    expect(safeAuthReturnTo(undefined)).toBe('/inicio')
    expect(authFlowLink('/entrar', undefined)).toBe('/entrar')
  })
})

describe('auth validation and recovery guidance', () => {
  it('validates email before making an auth request', () => {
    expect(validateAuthEmail(' pessoa@example.test ')).toBeUndefined()
    expect(validateAuthEmail('pessoa')).toBeTruthy()
  })

  it('requires a strong matching new password', () => {
    expect(validatePasswordChange('NovaSenha123', 'NovaSenha123')).toEqual({})
    expect(validatePasswordChange('fraca', '')).toMatchObject({ password: expect.any(String), confirmation: expect.any(String) })
    expect(validatePasswordChange('NovaSenha123', 'OutraSenha123').confirmation).toBe('As senhas não coincidem.')
  })

  it('offers a recovery action instead of exposing untranslated service details', () => {
    expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'signIn')).toMatch(/Esqueci minha senha/)
    expect(authErrorMessage({ code: 'email_not_confirmed' }, 'signIn')).toMatch(/reenviar/)
    expect(authErrorMessage({ code: 'flow_state_expired' }, 'password')).toMatch(/mesmo navegador/)
    expect(authErrorMessage({ status: 429 }, 'recovery')).toMatch(/Aguarde/)
    expect(authErrorMessage(new TypeError('Failed to fetch'), 'recovery')).toMatch(/internet/)
    expect(authErrorMessage(new Error('secret internal service detail'), 'signUp')).not.toContain('secret')
  })
})
