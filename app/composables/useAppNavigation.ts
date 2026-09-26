import type { NavigationItem } from '~/types/domain'
import { canAccessChildren, canManageChurch, canOperateStore, hasRole } from '~/utils/authorization'

export function useAppNavigation() {
  const auth = useAuthStore()
  const memberItems: NavigationItem[] = [
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
    { label: 'Atendimento da loja', icon: 'i-lucide-package-check', to: '/operacao', group: 'operations', requires: 'store_operator' },
    { label: 'Controle de estoque', icon: 'i-lucide-boxes', to: '/operacao/estoque', group: 'operations', requires: 'cashier' },
    { label: 'Relatórios do caixa', icon: 'i-lucide-chart-no-axes-combined', to: '/operacao/relatorios', group: 'operations', requires: 'cashier' }
  ]

  const administratorItems: NavigationItem[] = [
    { label: 'Visão geral', icon: 'i-lucide-layout-dashboard', to: '/admin', group: 'main', requires: 'administrator' },
    { label: 'Pessoas e permissões', icon: 'i-lucide-users-round', to: '/admin/pessoas', group: 'administration', requires: 'administrator' },
    { label: 'Conteúdo e avisos', icon: 'i-lucide-newspaper', to: '/admin/conteudo', group: 'administration', requires: 'administrator' },
    { label: 'Agenda e eventos', icon: 'i-lucide-calendar-days', to: '/admin/agenda', group: 'administration', requires: 'administrator' },
    { label: 'Auditoria', icon: 'i-lucide-shield-check', to: '/admin/auditoria', group: 'administration', requires: 'administrator' },
    { label: 'Caixa e pedidos', icon: 'i-lucide-package-check', to: '/operacao', group: 'operations', requires: 'administrator' },
    { label: 'Controle de estoque', icon: 'i-lucide-boxes', to: '/operacao/estoque', group: 'operations', requires: 'administrator' },
    { label: 'Relatórios', icon: 'i-lucide-chart-no-axes-combined', to: '/operacao/relatorios', group: 'operations', requires: 'administrator' }
  ]

  function canSeeItem(item: NavigationItem) {
    if (item.requires === 'guardian') return canAccessChildren(auth.profile)
    if (item.requires === 'administrator') return canManageChurch(auth.profile)
    if (item.requires === 'store_operator') return canOperateStore(auth.profile)
    if (item.requires === 'cashier') return canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier')
    if (item.requires) return hasRole(auth.profile, item.requires)
    return true
  }

  const visibleMemberItems = computed(() => memberItems.filter(canSeeItem))
  const visibleAdministratorItems = computed(() => administratorItems.filter(canSeeItem))

  return {
    items: memberItems,
    visibleItems: visibleMemberItems,
    visibleMemberItems,
    visibleAdministratorItems
  }
}
