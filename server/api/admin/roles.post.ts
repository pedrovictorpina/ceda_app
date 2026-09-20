import type { SystemRole } from '~/types/domain'
import { useSupabaseAdmin, useSupabaseTokenVerifier } from '~~/server/utils/supabaseAdmin'

const manageableRoles: SystemRole[] = ['administrator', 'pastor', 'cashier', 'counter']
const allRoles: SystemRole[] = ['member', ...manageableRoles]

interface RoleChangePayload {
  userId?: unknown
  role?: unknown
  enabled?: unknown
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function normalizedRoles(value: unknown): SystemRole[] {
  const roles = Array.isArray(value)
    ? value.filter((role): role is SystemRole => typeof role === 'string' && allRoles.includes(role as SystemRole))
    : []
  return [...new Set<SystemRole>(['member', ...roles])]
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

  const requesterRoles = normalizedRoles(requester.app_metadata?.roles)
  if (!requesterRoles.includes('administrator')) {
    throw createError({ statusCode: 403, statusMessage: 'Somente administradores podem alterar papéis do sistema.' })
  }

  const targetUserId = payload.userId
  const role = payload.role as SystemRole
  const enabled = payload.enabled
  if (targetUserId === requester.id) {
    throw createError({ statusCode: 400, statusMessage: 'Por segurança, não é permitido alterar os próprios papéis.' })
  }

  const admin = useSupabaseAdmin()
  const { data: targetData, error: targetError } = await admin.auth.admin.getUserById(targetUserId)
  const target = targetData.user
  if (targetError || !target) throw createError({ statusCode: 404, statusMessage: 'O usuário selecionado não foi encontrado.' })

  const previousRoles = normalizedRoles(target.app_metadata?.roles)
  const nextRoles = enabled
    ? [...new Set([...previousRoles, role])]
    : previousRoles.filter(currentRole => currentRole !== role)

  const { data: existingRoleRow, error: existingRoleError } = await admin
    .from('user_system_roles')
    .select('user_id, role, granted_by, granted_at')
    .eq('user_id', targetUserId)
    .eq('role', role)
    .maybeSingle()
  if (existingRoleError) throw createError({ statusCode: 500, statusMessage: 'Não foi possível verificar o papel atual.' })

  if (enabled) {
    const { error } = await admin
      .from('user_system_roles')
      .upsert({ user_id: targetUserId, role, granted_by: requester.id }, { onConflict: 'user_id,role' })
    if (error) throw createError({ statusCode: 500, statusMessage: 'Não foi possível registrar o novo papel.' })
  } else {
    const { error } = await admin
      .from('user_system_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('role', role)
    if (error) throw createError({ statusCode: 500, statusMessage: 'Não foi possível remover o papel registrado.' })
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(targetUserId, {
    app_metadata: { ...target.app_metadata, roles: nextRoles }
  })

  if (updateError) {
    const rollback = enabled
      ? admin.from('user_system_roles').delete().eq('user_id', targetUserId).eq('role', role)
      : existingRoleRow
        ? admin.from('user_system_roles').insert(existingRoleRow)
        : Promise.resolve({ error: null })
    await rollback
    throw createError({ statusCode: 502, statusMessage: 'O papel não foi sincronizado com a autenticação. Nenhuma alteração foi mantida.' })
  }

  return {
    roles: nextRoles,
    sessionRefreshRequired: true
  }
})
