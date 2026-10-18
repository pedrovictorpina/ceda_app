import type { SystemRole } from '~/types/domain'
import { normalizeSystemRoles, storeOperatorRoles } from '../../../app/utils/systemRoles'
import { useSupabaseAdmin, useSupabaseTokenVerifier } from '../../utils/supabaseAdmin'

const manageableRoles: SystemRole[] = ['administrator', 'pastor', 'cashier', 'counter', 'teacher']

interface RoleChangePayload {
  userId?: unknown
  role?: unknown
  enabled?: unknown
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export default defineEventHandler(async (event) => {
  const authorization = getHeader(event, 'authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) throw createError({ statusCode: 401, statusMessage: 'Sessão administrativa não encontrada.' })

  const payload = await readBody<RoleChangePayload>(event)
  if (!isUuid(payload.userId) || !manageableRoles.includes(payload.role as SystemRole) || typeof payload.enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'Dados de alteração de papel inválidos.' })
  }

  const verifier = useSupabaseTokenVerifier()
  const { data: requesterData, error: requesterError } = await verifier.auth.getUser(token)
  const requester = requesterData.user
  if (requesterError || !requester) throw createError({ statusCode: 401, statusMessage: 'A sessão não é mais válida.' })

  const requesterRoles = normalizeSystemRoles(requester.app_metadata?.roles)
  if (!requesterRoles.includes('administrator')) {
    throw createError({ statusCode: 403, statusMessage: 'Somente administradores podem alterar papéis do sistema.' })
  }

  const targetUserId = payload.userId
  const role = payload.role === 'counter' ? 'cashier' : payload.role as SystemRole
  const affectedRoles = role === 'cashier' ? [...storeOperatorRoles] : [role]
  const enabled = payload.enabled
  if (targetUserId === requester.id) {
    throw createError({ statusCode: 400, statusMessage: 'Por segurança, não é permitido alterar os próprios papéis.' })
  }

  const admin = useSupabaseAdmin()
  const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetUserId)
  const target = targetData.user
  if (targetError || !target) throw createError({ statusCode: 404, statusMessage: 'O usuário selecionado não foi encontrado.' })

  const previousRoles = [...new Set<SystemRole>(['member', ...normalizeSystemRoles(target.app_metadata?.roles)])]
  const nextRoles = enabled
    ? [...new Set([...previousRoles, role])]
    : previousRoles.filter(currentRole => currentRole !== role)
  const storedRoles = nextRoles.includes('cashier') ? [...nextRoles, 'counter'] : nextRoles
  const grantedAt = new Date().toISOString()

  // Returned rows are exactly the grants changed by this request. Existing
  // grants retain their original audit fields and never enter an enable rollback.
  const { data: changedRows, error: roleError } = enabled
    ? await admin
        .from('user_system_roles')
        .upsert(affectedRoles.map(currentRole => ({ user_id: targetUserId, role: currentRole, granted_by: requester.id, granted_at: grantedAt })), { onConflict: 'user_id,role', ignoreDuplicates: true })
        .select('user_id, role, granted_by, granted_at')
    : await admin
        .from('user_system_roles')
        .delete()
        .eq('user_id', targetUserId)
        .in('role', affectedRoles)
        .select('user_id, role, granted_by, granted_at')
  if (roleError) throw createError({ statusCode: 500, statusMessage: enabled ? 'Não foi possível registrar o novo papel.' : 'Não foi possível remover o papel registrado.' })

  try {
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      app_metadata: { ...target.app_metadata, roles: storedRoles }
    })
    if (error) throw error
  } catch {
    try {
      if (changedRows?.length) {
        const rollback = enabled
          ? await admin.from('user_system_roles').delete()
              .eq('user_id', targetUserId)
              .in('role', changedRows.map(row => row.role))
              .eq('granted_by', requester.id)
              .eq('granted_at', grantedAt)
              .select('role')
          : await admin.from('user_system_roles').insert(changedRows)
        if (rollback.error || (enabled && rollback.data?.length !== changedRows.length)) throw new Error('Role rollback failed')
      }
    } catch {
      throw createError({ statusCode: 500, statusMessage: 'A sincronização dos papéis falhou e não foi possível reverter todos os registros. Confira os papéis do usuário antes de tentar novamente.', data: { code: 'ROLE_ROLLBACK_FAILED' } })
    }
    throw createError({ statusCode: 502, statusMessage: 'O papel não foi sincronizado com a autenticação. As alterações no banco foram revertidas.', data: { code: 'ROLE_AUTH_SYNC_FAILED' } })
  }

  return {
    roles: nextRoles,
    sessionRefreshRequired: true
  }
})
