import { expect, test } from '@playwright/test'

test('public routes render their primary content', async ({ page }) => {
  const routes = [
    ['/', 'Comunidade que caminha junta.'],
    ['/entrar', 'Área de membros'],
    ['/cadastro', 'Criar cadastro'],
    ['/sobre', 'Sobre Nós'],
    ['/contato', 'Fale Conosco'],
    ['/horarios-de-culto', 'Horários de Culto'],
    ['/privacidade', 'Política de Privacidade']
  ] as const

  for (const [path, heading] of routes) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
  }
})

test('protected routes redirect signed-out visitors to login', async ({ page }) => {
  const protectedRoutes = [
    '/inicio', '/palavra-do-dia', '/noticias', '/comunidade', '/oracao',
    '/eventos', '/feed', '/galeria', '/campanhas', '/social', '/notificacoes', '/celulas',
    '/ovelhinhas', '/perfil', '/design-system', '/admin'
  ]

  for (const path of protectedRoutes) {
    await page.goto(path)
    await expect(page).toHaveURL(/\/entrar$/)
  }
})

test('theme and public navigation are keyboard-accessible', async ({ page }) => {
  await page.goto('/')
  const themeButton = page.getByRole('button', { name: /dark mode/i })
  await themeButton.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.getByRole('link', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})

test('login exposes secure access controls and registration link', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page.getByText('Ambiente local sem Supabase')).toHaveCount(0)
  const password = page.getByLabel('Senha', { exact: true })
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar senha' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar senha' })).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Lembrar meu acesso' })).not.toBeChecked()
  await page.getByRole('link', { name: 'Criar cadastro' }).click()
  await expect(page).toHaveURL(/\/cadastro$/)
})

test('registration validates fields, privacy acceptance and return link', async ({ page }) => {
  await page.goto('/cadastro')
  await expect(page.getByText('Ambiente sem Supabase')).toHaveCount(0)
  await page.getByRole('button', { name: 'Criar cadastro' }).click()
  await expect(page.getByText('Informe seu nome completo.')).toBeVisible()
  await expect(page.getByText('Informe um e-mail válido.')).toBeVisible()
  await expect(page.getByText('Use ao menos 8 caracteres, com maiúscula, minúscula e número.')).toBeVisible()
  await expect(page.getByText('Confirme sua senha.')).toBeVisible()
  await expect(page.getByText('Você precisa aceitar a Política de Privacidade.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Política de Privacidade' })).toHaveAttribute('href', '/privacidade')
  await page.getByRole('link', { name: 'Voltar para entrar' }).click()
  await expect(page).toHaveURL(/\/entrar$/)
})
