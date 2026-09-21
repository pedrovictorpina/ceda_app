import { expect, test } from '@playwright/test'

test('local signup, persistence choice and responsive member navigation work end to end', async ({ page }) => {
  const uniqueEmail = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`
  const password = 'SenhaE2e123'

  await page.goto('/cadastro')
  await page.getByLabel('Nome completo').fill('Membro E2E')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Telefone (opcional)').fill('+55 11 99999-0000')
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByLabel('Confirmar senha').fill(password)
  await page.getByRole('checkbox', { name: /Li e aceito/ }).check()
  await page.getByRole('button', { name: 'Criar cadastro' }).click()
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 })

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await expect(page.getByRole('checkbox', { name: 'Lembrar meu acesso' })).toBeChecked()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 })

  const durableSession = await page.evaluate(secret => ({
    durableAuthKeys: Object.keys(localStorage).filter(key => key.includes('auth-token')),
    tabAuthKeys: Object.keys(sessionStorage).filter(key => key.includes('auth-token')),
    passwordStored: JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret)
  }), password)
  expect(durableSession.durableAuthKeys.length).toBeGreaterThan(0)
  expect(durableSession.tabAuthKeys).toHaveLength(0)
  expect(durableSession.passwordStored).toBe(false)

  await page.reload()
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 })
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible()

  await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByText('Palavra do Dia')).toBeVisible()

  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill(uniqueEmail)
  await page.getByLabel('Senha', { exact: true }).fill(password)
  await page.getByRole('checkbox', { name: 'Lembrar meu acesso' }).check()
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page).toHaveURL(/\/inicio$/, { timeout: 15_000 })

  const rememberedSession = await page.evaluate(secret => ({
    preference: localStorage.getItem('ceda.auth.remember-access'),
    durableAuthKeys: Object.keys(localStorage).filter(key => key.includes('auth-token')),
    tabAuthKeys: Object.keys(sessionStorage).filter(key => key.includes('auth-token')),
    passwordStored: JSON.stringify({ ...localStorage, ...sessionStorage }).includes(secret)
  }), password)
  expect(rememberedSession.preference).toBe('true')
  expect(rememberedSession.durableAuthKeys.length).toBeGreaterThan(0)
  expect(rememberedSession.tabAuthKeys).toHaveLength(0)
  expect(rememberedSession.passwordStored).toBe(false)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('navigation', { name: 'Navegação móvel' })).toBeVisible()
  await page.getByRole('button', { name: 'Menu' }).click()
  await expect(page.getByRole('dialog', { name: 'Menu' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Menu' }).getByText('Perfil')).toBeVisible()
})
