import type { NavigationItem } from '~/types/domain'
import { canAccessChildren, canManageChurch, hasRole } from '~/utils/authorization'

export function useAppNavigation() {
  const auth = useAuthStore()
  const items: NavigationItem[] = [
    { label: 'Início', icon: 'i-lucide-house', to: '/inicio', group: 'main' },
    { label: 'Palavra do Dia', icon: 'i-lucide-book-open-text', to: '/palavra-do-dia', group: 'main' },
    { label: 'Notícias', icon: 'i-lucide-newspaper', to: '/noticias', group: 'main' },
    { label: 'Eventos', icon: 'i-lucide-calendar-days', to: '/eventos', group: 'main' },
    { label: 'Loja', icon: 'i-lucide-shopping-bag', to: '/loja', group: 'main' },
    { label: 'Comunidade', icon: 'i-lucide-users', to: '/comunidade', group: 'community' },
    { label: 'Células', icon: 'i-lucide-house-heart', to: '/celulas', group: 'community' },
    { label: 'Feed', icon: 'i-lucide-messages-square', to: '/feed', group: 'community' },
    { label: 'Motivos de oração', icon: 'i-lucide-heart', to: '/oracao', group: 'community' },
    { label: 'Horários de Culto', icon: 'i-lucide-clock-3', to: '/horarios-de-culto', group: 'church' },
    { label: 'Sobre Nós', icon: 'i-lucide-landmark', to: '/sobre', group: 'church' },
    { label: 'Fale Conosco', icon: 'i-lucide-mail', to: '/contato', group: 'church' },
    { label: 'Galeria', icon: 'i-lucide-images', to: '/galeria', group: 'more' },
    { label: 'Campanhas', icon: 'i-lucide-hand-coins', to: '/campanhas', group: 'more' },
    { label: 'Social', icon: 'i-lucide-square-play', to: '/social', group: 'more' },
    { label: 'Design System', icon: 'i-lucide-palette', to: '/design-system', group: 'more', webOnly: true },
    { label: 'Notificações', icon: 'i-lucide-bell', to: '/notificacoes', group: 'account' },
    { label: 'Ovelhinhas', icon: 'i-lucide-heart-handshake', to: '/ovelhinhas', group: 'account', requires: 'guardian' },
    { label: 'Perfil', icon: 'i-lucide-user-round', to: '/perfil', group: 'account' },
    { label: 'Política de Privacidade', icon: 'i-lucide-file-lock-2', to: '/privacidade', group: 'account' },
    { label: 'Caixa e estoque', icon: 'i-lucide-package-check', to: '/operacao', group: 'administration', requires: 'cashier' },
    { label: 'Relatórios', icon: 'i-lucide-chart-no-axes-combined', to: '/operacao/relatorios', group: 'administration', requires: 'cashier' },
    { label: 'Administração', icon: 'i-lucide-shield-check', to: '/admin', group: 'administration', requires: 'administrator' }
  ]
  const visibleItems = computed(() => items.filter((item) => {
    if (item.requires === 'guardian') return canAccessChildren(auth.profile)
    if (item.requires === 'administrator') return canManageChurch(auth.profile)
    if (item.requires === 'cashier') return canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier') || hasRole(auth.profile, 'counter')
    if (item.requires) return hasRole(auth.profile, item.requires)
    return true
  }))
  return { items, visibleItems }
}
