import type { NavigationItem } from '~/types/domain'
import { canAccessChildren, canManageChurch, hasRole } from '~/utils/authorization'

export function useAppNavigation() {
  const auth = useAuthStore()
  const items: NavigationItem[] = [
    { label: 'Início', icon: 'i-lucide-house', to: '/inicio' },
    { label: 'Palavra do Dia', icon: 'i-lucide-book-open-text', to: '/palavra-do-dia' },
    { label: 'Notícias', icon: 'i-lucide-newspaper', to: '/noticias' },
    { label: 'Comunidade', icon: 'i-lucide-users', to: '/comunidade' },
    { label: 'Células', icon: 'i-lucide-house-heart', to: '/celulas' },
    { label: 'Motivos de oração', icon: 'i-lucide-heart', to: '/oracao' },
    { label: 'Eventos', icon: 'i-lucide-calendar-days', to: '/eventos' },
    { label: 'Horários de Culto', icon: 'i-lucide-clock-3', to: '/horarios-de-culto' },
    { label: 'Feed', icon: 'i-lucide-messages-square', to: '/feed' },
    { label: 'Galeria', icon: 'i-lucide-images', to: '/galeria' },
    { label: 'Campanhas', icon: 'i-lucide-hand-coins', to: '/campanhas' },
    { label: 'Social', icon: 'i-lucide-play-square', to: '/social' },
    { label: 'Sobre Nós', icon: 'i-lucide-landmark', to: '/sobre' },
    { label: 'Fale Conosco', icon: 'i-lucide-mail', to: '/contato' },
    { label: 'Notificações', icon: 'i-lucide-bell', to: '/notificacoes' },
    { label: 'Ovelhinhas', icon: 'i-lucide-heart-handshake', to: '/ovelhinhas', requires: 'guardian' },
    { label: 'Perfil', icon: 'i-lucide-user-round', to: '/perfil' },
    { label: 'Política de Privacidade', icon: 'i-lucide-file-lock-2', to: '/privacidade' },
    { label: 'Design System', icon: 'i-lucide-palette', to: '/design-system', webOnly: true },
    { label: 'Administração', icon: 'i-lucide-shield-check', to: '/admin', requires: 'administrator' }
  ]
  const visibleItems = computed(() => items.filter((item) => {
    if (item.requires === 'guardian') return canAccessChildren(auth.profile)
    if (item.requires === 'administrator') return canManageChurch(auth.profile)
    if (item.requires) return hasRole(auth.profile, item.requires)
    return true
  }))
  return { items, visibleItems }
}
