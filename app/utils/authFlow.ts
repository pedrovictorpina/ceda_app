const memberRoutes = new Set([
  '/inicio', '/palavra-do-dia', '/noticias', '/galeria', '/social', '/eventos', '/loja',
  '/sementinhas', '/sementinhas/turmas', '/ovelhinhas', '/celulas', '/comunidade', '/feed',
  '/oracao', '/aniversariantes', '/perfil', '/notificacoes', '/salvos', '/sobre', '/contato',
  '/horarios-de-culto', '/campanhas', '/privacidade', '/admin', '/admin/pessoas',
  '/admin/agenda', '/admin/conteudo', '/admin/auditoria', '/operacao', '/operacao/estoque', '/operacao/relatorios'
])

export function isPublicSessionRoute(route: { meta: { layout?: unknown } }) {
  return route.meta.layout === 'public' || route.meta.layout === 'institutional'
}

/** Only application destinations are accepted; auth pages and external URLs never become redirects. */
export function safeAuthReturnTo(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/inicio'
  if ([...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127)) return '/inicio'
  try {
    const url = new URL(value, 'https://ceda.invalid')
    const pathname = decodeURIComponent(url.pathname).replace(/\/$/, '') || '/'
    const knownDetail = /^\/(celulas|noticias|mensagens)\/[a-zA-Z0-9_-]+$/.test(pathname)
    if (url.origin !== 'https://ceda.invalid' || (!memberRoutes.has(pathname) && !knownDetail)) return '/inicio'
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return '/inicio'
  }
}

export function authFlowLink(path: '/entrar' | '/cadastro' | '/recuperar-senha' | '/redefinir-senha', destination: unknown): string {
  const next = safeAuthReturnTo(destination)
  return next === '/inicio' ? path : `${path}?${new URLSearchParams({ next })}`
}

export function authDestinationLabel(destination: string): string {
  if (destination.startsWith('/oracao')) return 'seu pedido de oração'
  if (destination.startsWith('/celulas')) return 'as células'
  if (destination.startsWith('/comunidade')) return 'os grupos da comunidade'
  if (destination.startsWith('/sementinhas')) return 'o Sementinhas'
  if (destination.startsWith('/loja')) return 'a loja'
  return 'a página que você escolheu'
}

export function validateAuthEmail(email: string): string | undefined {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ? undefined : 'Informe um e-mail válido.'
}

export function validatePasswordChange(password: string, confirmation: string): { password?: string, confirmation?: string } {
  const errors: { password?: string, confirmation?: string } = {}
  if (password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'Use ao menos 8 caracteres, com maiúscula, minúscula e número.'
  }
  if (!confirmation) errors.confirmation = 'Confirme sua nova senha.'
  else if (password !== confirmation) errors.confirmation = 'As senhas não coincidem.'
  return errors
}

export type AuthAction = 'signIn' | 'signUp' | 'recovery' | 'password' | 'session'

/** Service messages may be in English or expose internals; show actionable Portuguese instead. */
export function authErrorMessage(error: unknown, action: AuthAction): string {
  const detail = error && typeof error === 'object' ? error as { code?: unknown, name?: unknown, message?: unknown, status?: unknown } : {}
  const code = String(detail.code || '')
  if (['invalid_credentials', 'user_not_found'].includes(code)) return 'E-mail ou senha incorretos. Confira os dados ou escolha “Esqueci minha senha”.'
  if (code === 'email_not_confirmed') return 'Confirme seu e-mail antes de entrar. Procure a mensagem da CEDA na caixa de entrada e no spam. Você também pode reenviar a confirmação abaixo.'
  if (['over_email_send_rate_limit', 'over_request_rate_limit'].includes(code) || detail.status === 429) return 'Aguarde alguns minutos antes de tentar novamente. Se já pediu um e-mail, confira também a pasta de spam.'
  if (['otp_expired', 'flow_state_expired', 'flow_state_not_found', 'bad_code_verifier'].includes(code)) return 'Este link expirou ou não pode ser aberto neste navegador. Peça um novo link e abra-o no mesmo navegador em que fez o pedido.'
  if (code === 'same_password') return 'Escolha uma senha diferente da atual.'
  if (code === 'weak_password') return 'Escolha uma senha mais forte, com ao menos 8 caracteres, maiúscula, minúscula e número.'
  if (['user_already_exists', 'email_exists'].includes(code)) return 'Este e-mail já possui cadastro. Entre na sua conta ou recupere a senha.'
  if (code === 'signup_disabled') return 'O cadastro está temporariamente indisponível. Tente novamente mais tarde ou fale com a recepção.'
  if (code === 'session_not_found' || code === 'refresh_token_not_found' || detail.name === 'AuthSessionMissingError') return 'Abra o link recebido por e-mail para escolher sua nova senha. Se ele expirou ou já foi usado, peça outro link.'
  if (error instanceof TypeError || /fetch|network|failed to fetch/i.test(String(detail.message || ''))) return 'Não foi possível conectar. Confira sua internet e tente novamente; seus dados continuam no formulário.'
  return {
    signIn: 'Não foi possível entrar agora. Confira os dados e tente novamente. Se esqueceu a senha, use a recuperação de acesso.',
    signUp: 'Não foi possível criar seu cadastro agora. Tente novamente em instantes; seus dados continuam no formulário.',
    recovery: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes ou procure a recepção.',
    password: 'Não foi possível atualizar sua senha. Tente novamente; se o link expirou, peça um novo.',
    session: 'Não foi possível verificar seu acesso. Confira sua internet e tente novamente.'
  }[action]
}
