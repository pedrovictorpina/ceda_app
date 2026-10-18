import type { SystemRole } from '../types/domain'

/** Both persisted values represent the same role; keep the alias for older clients. */
export const storeOperatorRoles = ['cashier', 'counter'] as const

const systemRoles: readonly SystemRole[] = ['member', 'administrator', 'pastor', ...storeOperatorRoles, 'teacher']

export function normalizeSystemRoles(value: unknown): SystemRole[] {
  if (!Array.isArray(value)) return []
  const validRoles = value.filter((role): role is SystemRole => systemRoles.includes(role))
  return [...new Set(validRoles.map(role => role === 'counter' ? 'cashier' : role))]
}
