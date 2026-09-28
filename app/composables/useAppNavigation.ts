import type { NavigationItem, NavigationRequirement, NavigationSection } from '~/types/domain'
import { canAccessChildren, canManageChurch, canOperateStore, canTeachChildren, hasRole } from '~/utils/authorization'

// Páginas irmãs ficam agrupadas em uma só entrada do menu e ganham abas no topo.
const sections: NavigationSection[] = [
  {
    id: 'conteudo',
    label: 'Conteúdo',
    tabs: [
      { label: 'Palavra do Dia', icon: 'i-lucide-book-open-text', to: '/palavra-do-dia' },
      { label: 'Notícias', icon: 'i-lucide-newspaper', to: '/noticias' },
      { label: 'Galeria', icon: 'i-lucide-images', to: '/galeria' },
      { label: 'Social', icon: 'i-lucide-square-play', to: '/social' }
    ]
  },
  {
    id: 'igreja',
    label: 'A Igreja',
    tabs: [
      { label: 'Horários de Culto', icon: 'i-lucide-clock-3', to: '/horarios-de-culto' },
      { label: 'Sobre Nós', icon: 'i-lucide-landmark', to: '/sobre' },
      { label: 'Fale Conosco', icon: 'i-lucide-mail', to: '/contato' },
      { label: 'Campanhas', icon: 'i-lucide-hand-coins', to: '/campanhas' }
    ]
  },
  {
    id: 'sementinhas',
    label: 'Sementinhas',
    tabs: [
      { label: 'Minhas crianças', icon: 'i-lucide-sprout', to: '/sementinhas', requires: 'guardian' },
      { label: 'Turmas', icon: 'i-lucide-school', to: '/sementinhas/turmas', requires: 'children_staff' }
    ]
  },
  {
    id: 'operacao',
    label: 'Operação da loja',
    tabs: [
      { label: 'Atendimento', icon: 'i-lucide-package-check', to: '/operacao', requires: 'store_operator' },
      { label: 'Estoque', icon: 'i-lucide-boxes', to: '/operacao/estoque', requires: 'cashier' },
      { label: 'Relatórios', icon: 'i-lucide-chart-no-axes-combined', to: '/operacao/relatorios', requires: 'cashier' }
    ]
  }
]

const memberItems: NavigationItem[] = [
  { label: 'Início', icon: 'i-lucide-house', to: '/inicio', group: 'main' },
  { label: 'Conteúdo', icon: 'i-lucide-book-open-text', to: '/palavra-do-dia', group: 'main', matches: ['/noticias', '/galeria', '/social'], keywords: ['Palavra do Dia', 'Notícias', 'Galeria', 'Social'] },
  { label: 'Eventos', icon: 'i-lucide-calendar-days', to: '/eventos', group: 'main', keywords: ['agenda'] },
  { label: 'Loja', icon: 'i-lucide-shopping-bag', to: '/loja', group: 'main', keywords: ['pedido', 'cantina'] },
  { label: 'Sementinhas', icon: 'i-lucide-sprout', to: '/sementinhas', group: 'main', requires: 'guardian', keywords: ['crianças', 'filhos', 'turmas', 'check-in'] },
  { label: 'Células', icon: 'i-lucide-house-heart', to: '/celulas', group: 'community' },
  { label: 'Comunidade', icon: 'i-lucide-users', to: '/comunidade', group: 'community' },
  { label: 'Feed', icon: 'i-lucide-messages-square', to: '/feed', group: 'community' },
  { label: 'Oração', icon: 'i-lucide-heart', to: '/oracao', group: 'community', keywords: ['motivos de oração', 'pedidos'] },
  { label: 'Aniversariantes', icon: 'i-lucide-cake', to: '/aniversariantes', group: 'community' },
  { label: 'A Igreja', icon: 'i-lucide-landmark', to: '/horarios-de-culto', group: 'church', matches: ['/sobre', '/contato', '/campanhas'], keywords: ['Horários de Culto', 'Sobre Nós', 'Fale Conosco', 'Campanhas', 'contato'] },
  { label: 'Operação da loja', shortLabel: 'Operação', icon: 'i-lucide-package-check', to: '/operacao', group: 'operations', requires: 'store_operator', keywords: ['caixa', 'estoque', 'relatórios', 'atendimento'] },
  { label: 'Design System', icon: 'i-lucide-palette', to: '/design-system', group: 'more', webOnly: true }
]

const administratorItems: NavigationItem[] = [
  { label: 'Painel', icon: 'i-lucide-layout-dashboard', to: '/admin', group: 'main', requires: 'administrator', keywords: ['visão geral', 'dashboard'] },
  { label: 'Pessoas', icon: 'i-lucide-users-round', to: '/admin/pessoas', group: 'administration', requires: 'administrator', keywords: ['permissões', 'professores', 'papéis'] },
  { label: 'Agenda', icon: 'i-lucide-calendar-days', to: '/admin/agenda', group: 'administration', requires: 'administrator', keywords: ['eventos'] },
  { label: 'Conteúdo e avisos', icon: 'i-lucide-newspaper', to: '/admin/conteudo', group: 'administration', requires: 'administrator' },
  { label: 'Auditoria', icon: 'i-lucide-shield-check', to: '/admin/auditoria', group: 'administration', requires: 'administrator' },
  { label: 'Sementinhas', icon: 'i-lucide-sprout', to: '/sementinhas/turmas', group: 'administration', requires: 'children_staff', keywords: ['turmas', 'crianças'] },
  { label: 'Operação da loja', shortLabel: 'Operação', icon: 'i-lucide-package-check', to: '/operacao', group: 'operations', requires: 'administrator', keywords: ['caixa', 'estoque', 'relatórios', 'pedidos'] }
]

export function useAppNavigation() {
  const auth = useAuthStore()

  function meets(requirement?: NavigationRequirement) {
    if (!requirement) return true
    if (requirement === 'guardian') return canAccessChildren(auth.profile)
    if (requirement === 'children_staff') return canTeachChildren(auth.profile)
    if (requirement === 'administrator') return canManageChurch(auth.profile)
    if (requirement === 'store_operator') return canOperateStore(auth.profile)
    if (requirement === 'cashier') return canManageChurch(auth.profile) || hasRole(auth.profile, 'cashier')
    return hasRole(auth.profile, requirement)
  }

  const visibleMemberItems = computed(() => memberItems.filter(item => meets(item.requires)))
  const visibleAdministratorItems = computed(() => administratorItems.filter(item => meets(item.requires)))
  const visibleSections = computed(() => sections
    .map(section => ({ ...section, tabs: section.tabs.filter(tab => meets(tab.requires)) }))
    .filter(section => section.tabs.length > 1))

  return {
    items: memberItems,
    visibleItems: visibleMemberItems,
    visibleMemberItems,
    visibleAdministratorItems,
    visibleSections
  }
}
