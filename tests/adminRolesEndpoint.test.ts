import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SystemRole } from '../app/types/domain'

const dependencies = vi.hoisted(() => ({ admin: vi.fn(), verifier: vi.fn() }))
vi.mock('../server/utils/supabaseAdmin', () => ({ useSupabaseAdmin: dependencies.admin, useSupabaseTokenVerifier: dependencies.verifier }))

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
const { default: handler } = await import('../server/api/admin/roles.post')
vi.unstubAllGlobals()

const requesterId = '11111111-1111-4111-8111-111111111111'
const targetId = '22222222-2222-4222-8222-222222222222'
const otherUserId = '33333333-3333-4333-8333-333333333333'
interface Grant { user_id: string, role: SystemRole, granted_by: string | null, granted_at: string }
const grant = (role: SystemRole, userId = targetId): Grant => ({ user_id: userId, role, granted_by: otherUserId, granted_at: '2026-09-01T10:00:00.000Z' })

function fixture(initialRows: Grant[] = [], metadata: Record<string, unknown> = { roles: ['member'] }) {
  const state = {
    rows: structuredClone(initialRows),
    metadata: structuredClone(metadata),
    requesterRoles: ['administrator'],
    authorization: 'Bearer fixture-access-token',
    payload: { userId: targetId, role: 'cashier', enabled: true } as Record<string, unknown>,
    mutationCount: 0,
    failMutation: 0,
    throwMutation: 0
  }
  const from = vi.fn(() => {
    let operation: 'upsert' | 'insert' | 'delete'
    let values: Grant[] = []
    let ignoreDuplicates = false
    const filters: Array<(row: Grant) => boolean> = []
    const query = {
      upsert: vi.fn((rows: Grant[], options: { ignoreDuplicates?: boolean }) => {
        operation = 'upsert'
        values = rows
        ignoreDuplicates = Boolean(options.ignoreDuplicates)
        return query
      }),
      insert: vi.fn((rows: Grant[]) => {
        operation = 'insert'
        values = rows
        return query
      }),
      delete: vi.fn(() => {
        operation = 'delete'
        return query
      }),
      eq: vi.fn((column: keyof Grant, value: unknown) => {
        filters.push(row => row[column] === value)
        return query
      }),
      in: vi.fn((column: keyof Grant, allowed: unknown[]) => {
        filters.push(row => allowed.includes(row[column]))
        return query
      }),
      select: vi.fn(() => query),
      then(resolve: (value: { data: Grant[] | null, error: Error | null }) => unknown, reject: (reason: unknown) => unknown) {
        return Promise.resolve().then(() => {
          state.mutationCount += 1
          if (state.mutationCount === state.throwMutation) throw new Error('transport failed')
          if (state.mutationCount === state.failMutation) return { data: null, error: new Error('database failed') }
          if (operation === 'delete') {
            const removed = state.rows.filter(row => filters.every(matches => matches(row)))
            state.rows = state.rows.filter(row => !removed.includes(row))
            return { data: structuredClone(removed), error: null }
          }
          const exists = (value: Grant) => state.rows.some(row => row.user_id === value.user_id && row.role === value.role)
          if (!ignoreDuplicates && values.some(exists)) return { data: null, error: new Error('duplicate key') }
          const inserted = values.filter(value => !exists(value))
          state.rows.push(...structuredClone(inserted))
          return { data: structuredClone(inserted), error: null }
        }).then(resolve, reject)
      }
    }
    return query
  })
  const updateUserById = vi.fn(async (_userId: string, attributes: { app_metadata: Record<string, unknown> }): Promise<{ error: Error | null }> => {
    state.metadata = structuredClone(attributes.app_metadata)
    return { error: null }
  })
  const getUserById = vi.fn(async () => ({ data: { user: { id: targetId, app_metadata: structuredClone(state.metadata) } as { id: string, app_metadata: Record<string, unknown> } | null }, error: null as Error | null }))
  const getUser = vi.fn(async () => ({ data: { user: { id: requesterId, app_metadata: { roles: state.requesterRoles } } as { id: string, app_metadata: { roles: string[] } } | null }, error: null as Error | null }))
  dependencies.admin.mockReturnValue({ from, auth: { admin: { getUserById, updateUserById } } })
  dependencies.verifier.mockReturnValue({ auth: { getUser } })
  vi.stubGlobal('getHeader', () => state.authorization)
  vi.stubGlobal('readBody', async () => state.payload)
  vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string, data?: unknown }) => Object.assign(new Error(input.statusMessage), input))
  return { state, from, getUser, getUserById, updateUserById }
}

const invoke = () => handler({} as never)
beforeEach(() => vi.clearAllMocks())
afterEach(() => vi.unstubAllGlobals())

describe('administrative role endpoint', () => {
  it.each(['cashier', 'counter'])('enables both compatible grants through %s and returns only the canonical role', async (role) => {
    const previous = [grant('pastor'), grant('teacher', otherUserId)]
    const test = fixture(previous, { roles: ['member', 'pastor'], provider: 'email', settings: { preserved: true } })
    test.state.payload.role = role
    await expect(invoke()).resolves.toEqual({ roles: ['member', 'pastor', 'cashier'], sessionRefreshRequired: true })
    expect(test.state.rows).toEqual(expect.arrayContaining(previous))
    expect(test.state.rows.filter(row => row.user_id === targetId).map(row => row.role)).toEqual(['pastor', 'cashier', 'counter'])
    expect(test.state.metadata).toEqual({ roles: ['member', 'pastor', 'cashier', 'counter'], provider: 'email', settings: { preserved: true } })
  })

  it.each(['cashier', 'counter'])('removes both compatible grants through %s and preserves unrelated roles and metadata', async (role) => {
    const untouched = [grant('pastor'), grant('teacher'), grant('cashier', otherUserId)]
    const test = fixture([...untouched, grant('cashier'), grant('counter')], { roles: ['member', 'counter', 'pastor', 'cashier', 'teacher'], custom: 'retained' })
    test.state.payload = { userId: targetId, role, enabled: false }
    await expect(invoke()).resolves.toEqual({ roles: ['member', 'pastor', 'teacher'], sessionRefreshRequired: true })
    expect(test.state.rows).toEqual(untouched)
    expect(test.state.metadata).toEqual({ roles: ['member', 'pastor', 'teacher'], custom: 'retained' })
  })

  it('preserves the audit fields of an existing grant while repairing its missing alias', async () => {
    const existing = grant('counter')
    const test = fixture([existing], { roles: ['member', 'counter', 'counter'] })
    await expect(invoke()).resolves.toMatchObject({ roles: ['member', 'cashier'] })
    expect(test.state.rows.find(row => row.role === 'counter')).toEqual(existing)
    expect(test.state.rows.filter(row => row.role === 'cashier')).toHaveLength(1)
    expect(test.state.metadata.roles).toEqual(['member', 'cashier', 'counter'])
  })

  it('keeps enabling an existing pair idempotent without resetting its audit fields', async () => {
    const previous = [grant('cashier'), grant('counter')]
    const test = fixture(previous, { roles: ['member', 'cashier', 'counter'] })
    await invoke()
    expect(test.state.rows).toEqual(previous)
    expect(test.state.metadata.roles).toEqual(['member', 'cashier', 'counter'])
  })

  it('keeps other manageable roles independent while retaining the compatibility alias', async () => {
    const previous = [grant('cashier'), grant('counter')]
    const test = fixture(previous, { roles: ['member', 'counter'] })
    test.state.payload.role = 'teacher'
    await expect(invoke()).resolves.toMatchObject({ roles: ['member', 'cashier', 'teacher'] })
    expect(test.state.rows).toEqual(expect.arrayContaining(previous))
    expect(test.state.metadata.roles).toEqual(['member', 'cashier', 'teacher', 'counter'])
  })

  it('rolls back only newly inserted grants after an Auth error, keeping all preexisting rows exact', async () => {
    const previous = [grant('cashier'), grant('pastor'), grant('counter', otherUserId)]
    const test = fixture(previous, { roles: ['member', 'pastor', 'cashier'], custom: true })
    const metadata = structuredClone(test.state.metadata)
    test.updateUserById.mockResolvedValue({ error: new Error('Auth rejected') })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 502, data: { code: 'ROLE_AUTH_SYNC_FAILED' } })
    expect(test.state.rows).toEqual(previous)
    expect(test.state.metadata).toEqual(metadata)
  })

  it('does not remove existing grants when an idempotent enable fails in Auth', async () => {
    const previous = [grant('cashier'), grant('counter')]
    const test = fixture(previous, { roles: ['member', 'cashier', 'counter'] })
    test.updateUserById.mockResolvedValue({ error: new Error('Auth rejected') })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 502 })
    expect(test.state.rows).toEqual(previous)
    expect(test.state.mutationCount).toBe(1)
  })

  it.each([['cashier', 'counter'], ['counter']] as SystemRole[][])('restores exactly the removed grants, including their audit fields: %j', async (...roles) => {
    const removed = roles.map(role => grant(role))
    const untouched = [grant('pastor'), grant('cashier', otherUserId)]
    const test = fixture([...untouched, ...removed], { roles: ['member', 'pastor', ...roles] })
    test.state.payload.enabled = false
    test.updateUserById.mockResolvedValue({ error: new Error('Auth rejected') })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 502, data: { code: 'ROLE_AUTH_SYNC_FAILED' } })
    expect(test.state.rows).toEqual([...untouched, ...removed])
  })

  it('also rolls back grants when the Auth request throws a transport error', async () => {
    const test = fixture([grant('teacher')])
    test.updateUserById.mockRejectedValue(new Error('transport failed'))
    await expect(invoke()).rejects.toMatchObject({ statusCode: 502 })
    expect(test.state.rows).toEqual([grant('teacher')])
  })

  it('does not update Auth when the database mutation fails', async () => {
    const previous = [grant('teacher')]
    const test = fixture(previous)
    test.state.failMutation = 1
    await expect(invoke()).rejects.toMatchObject({ statusCode: 500 })
    expect(test.updateUserById).not.toHaveBeenCalled()
    expect(test.state.rows).toEqual(previous)
  })

  it.each(['failMutation', 'throwMutation'] as const)('reports a distinct rollback failure when the database %s fails', async (failure) => {
    const test = fixture()
    test.state[failure] = 2
    test.updateUserById.mockResolvedValue({ error: new Error('Auth rejected') })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 500, data: { code: 'ROLE_ROLLBACK_FAILED' } })
    expect(test.state.rows.map(row => row.role)).toEqual(['cashier', 'counter'])
  })

  it('preserves a concurrent replacement grant and reports that rollback could not fully finish', async () => {
    const test = fixture()
    test.updateUserById.mockImplementation(async () => {
      test.state.rows = [grant('cashier')]
      return { error: new Error('Auth rejected') }
    })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 500, data: { code: 'ROLE_ROLLBACK_FAILED' } })
    expect(test.state.rows).toEqual([grant('cashier')])
  })

  it('requires a bearer token before creating privileged clients', async () => {
    fixture().state.authorization = ''
    await expect(invoke()).rejects.toMatchObject({ statusCode: 401 })
    expect(dependencies.admin).not.toHaveBeenCalled()
    expect(dependencies.verifier).not.toHaveBeenCalled()
  })

  it('rejects an expired requester session', async () => {
    const test = fixture()
    test.getUser.mockResolvedValue({ data: { user: null }, error: new Error('expired') })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 401 })
    expect(dependencies.admin).not.toHaveBeenCalled()
  })

  it('requires the verified requester to have the administrator role', async () => {
    fixture().state.requesterRoles = ['member', 'cashier', 'counter']
    await expect(invoke()).rejects.toMatchObject({ statusCode: 403 })
    expect(dependencies.admin).not.toHaveBeenCalled()
  })

  it('forbids editing the requester own roles', async () => {
    fixture().state.payload.userId = requesterId
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 })
    expect(dependencies.admin).not.toHaveBeenCalled()
  })

  it.each([{ userId: 'invalid-id' }, { role: 'member' }, { role: 'unexpected' }, { enabled: 'true' }])('rejects malformed role changes: %j', async (invalid) => {
    const test = fixture()
    Object.assign(test.state.payload, invalid)
    await expect(invoke()).rejects.toMatchObject({ statusCode: 400 })
    expect(dependencies.verifier).not.toHaveBeenCalled()
    expect(dependencies.admin).not.toHaveBeenCalled()
  })

  it('rejects a missing target user without any database mutation', async () => {
    const test = fixture()
    test.getUserById.mockResolvedValue({ data: { user: null }, error: null })
    await expect(invoke()).rejects.toMatchObject({ statusCode: 404 })
    expect(test.from).not.toHaveBeenCalled()
  })
})
