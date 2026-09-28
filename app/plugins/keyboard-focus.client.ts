import { isOutsideVisibleArea, KEYBOARD_FIELD_SELECTOR } from '~/utils/keyboardFocus'

// Tempo para o teclado terminar de abrir e o viewport encolher.
const KEYBOARD_SETTLE_MS = 350

/**
 * Mantém o campo focado acima do teclado virtual, inclusive dentro de gavetas
 * com rolagem própria, e marca o documento enquanto o usuário digita.
 */
export default defineNuxtPlugin(() => {
  let focused: HTMLElement | null = null
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

  function visibleArea() {
    const viewport = window.visualViewport
    return viewport
      ? { top: viewport.offsetTop, bottom: viewport.offsetTop + viewport.height }
      : { top: 0, bottom: window.innerHeight }
  }

  function revealFocused() {
    if (!focused || document.activeElement !== focused) return
    if (!isOutsideVisibleArea(focused.getBoundingClientRect(), visibleArea())) return
    focused.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion.matches ? 'auto' : 'smooth' })
  }

  document.addEventListener('focusin', (event) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.matches(KEYBOARD_FIELD_SELECTOR)) return
    focused = target
    document.documentElement.dataset.typing = 'true'
    clearTimeout(settleTimer)
    settleTimer = setTimeout(revealFocused, KEYBOARD_SETTLE_MS)
  })

  document.addEventListener('focusout', () => {
    // Aguarda o próximo foco para não piscar a navegação ao trocar de campo.
    setTimeout(() => {
      const active = document.activeElement
      if (active instanceof HTMLElement && active.matches(KEYBOARD_FIELD_SELECTOR)) return
      focused = null
      delete document.documentElement.dataset.typing
    }, 0)
  })

  window.visualViewport?.addEventListener('resize', revealFocused)
  window.addEventListener('resize', revealFocused)
})
