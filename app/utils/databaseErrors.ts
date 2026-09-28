export interface DatabaseErrorLike {
  code?: string
  message?: string
}

// Codes raised on purpose by the Sementinhas functions with pt-BR messages.
const friendlyCodes = new Set(['P0001', '22023'])
const technicalPrefixes = ['new row violates', 'permission denied', 'duplicate key', 'violates']

/**
 * Mensagem segura para a interface: usa o texto do banco somente quando ele foi
 * escrito para o usuário; caso contrário, usa a mensagem de contingência.
 */
export function friendlyDatabaseError(error: DatabaseErrorLike | null | undefined, fallback: string): string {
  if (!error) return fallback
  if (error.code === '23505') return 'Esse registro já existe.'
  const message = error.message?.trim() ?? ''
  if (!message) return fallback
  const technical = technicalPrefixes.some(prefix => message.toLowerCase().includes(prefix))
  if (friendlyCodes.has(error.code ?? '') && !technical) return message
  if (error.code === '42501' && !technical) return message
  return fallback
}
