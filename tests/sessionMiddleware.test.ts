import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

vi.stubGlobal('defineNuxtRouteMiddleware', (handler: unknown) => handler)
const { default: middleware } = await import('../app/middleware/session.global')
vi.unstubAllGlobals()

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: {} }] })
const navigate = vi.fn()
const auth = {
  loading: true,
  profile: null as { id: string } | null,
  hydrate: vi.fn(async () => { auth.loading = false })
}
const visit = (path: string, layout?: 'public' | 'institutional') => {
  const to = router.resolve(path)
  to.meta.layout = layout
  return middleware(to, router.resolve('/'))
}

beforeEach(() => {
  auth.loading = true
  auth.profile = null
  auth.hydrate.mockReset().mockImplementation(async () => {
    auth.loading = false
  })
  navigate.mockReset()
  vi.stubGlobal('useAuthStore', () => auth)
  vi.stubGlobal('useNuxtApp', () => ({ isHydrating: false }))
  vi.stubGlobal('navigateTo', navigate)
})
afterEach(() => vi.unstubAllGlobals())

describe('session initialization before navigation', () => {
  it('defers public session restoration until server HTML has hydrated', async () => {
    vi.stubGlobal('useNuxtApp', () => ({ isHydrating: true }))
    await visit('/entrar', 'public')
    expect(auth.hydrate).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('verifies a private entry before its client-only page is mounted', async () => {
    vi.stubGlobal('useNuxtApp', () => ({ isHydrating: true }))
    await visit('/inicio')
    expect(auth.hydrate).toHaveBeenCalledOnce()
  })

  it('keeps public information and account recovery reachable when verification fails', async () => {
    for (const [path, layout] of [['/sobre', 'institutional'], ['/recuperar-senha', 'public']] as const) {
      auth.loading = true
      auth.hydrate.mockRejectedValueOnce(new Error('offline'))
      await visit(path, layout)
    }
    expect(navigate).not.toHaveBeenCalled()
  })
  it('waits for the restored profile before redirecting the home page', async () => {
    let finish!: () => void
    auth.hydrate.mockImplementationOnce(() => new Promise<void>((resolve) => {
      finish = () => {
        auth.profile = { id: 'fixture' }
        auth.loading = false
        resolve()
      }
    }))
    const pending = visit('/')
    expect(navigate).not.toHaveBeenCalled()
    finish()
    await pending
    expect(navigate).toHaveBeenCalledWith('/inicio', { replace: true })
  })

  it('keeps the public home available when there is no session', async () => {
    await visit('/')
    expect(auth.hydrate).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('restores the session even when the first page is institutional', async () => {
    await visit('/sobre')
    expect(auth.hydrate).toHaveBeenCalledOnce()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('sends a signed-in visitor of the login page to the requested task', async () => {
    auth.loading = false
    auth.profile = { id: 'fixture' }
    await visit('/entrar?next=%2Foracao')
    expect(navigate).toHaveBeenCalledWith('/oracao', { replace: true })
    expect(auth.hydrate).not.toHaveBeenCalled()
  })

  it('rejects external destinations after restoring a session', async () => {
    auth.loading = false
    auth.profile = { id: 'fixture' }
    await visit('/entrar?next=https%3A%2F%2Fexample.test')
    expect(navigate).toHaveBeenCalledWith('/inicio', { replace: true })
  })

  it('preserves a member deep link instead of replacing it with home', async () => {
    auth.loading = false
    auth.profile = { id: 'fixture' }
    await visit('/oracao')
    expect(navigate).not.toHaveBeenCalled()
  })

  it('explains verification failure and preserves the destination', async () => {
    auth.hydrate.mockRejectedValueOnce(new Error('offline'))
    await visit('/oracao')
    expect(navigate).toHaveBeenCalledWith({ path: '/entrar', query: { next: '/oracao', motivo: 'verificar' } }, { replace: true })
  })

  it('leaves password recovery in control of its code exchange', async () => {
    await visit('/redefinir-senha?code=fixture&recuperacao=nonce')
    expect(auth.hydrate).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
