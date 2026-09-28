/** Campos que abrem o teclado virtual. */
export const KEYBOARD_FIELD_SELECTOR = [
  'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="file"]):not([type="range"]):not([type="color"])',
  'textarea',
  'select',
  '[contenteditable="true"]'
].join(', ')

export interface VisibleArea {
  top: number
  bottom: number
}

/** Indica se o campo está escondido pelo teclado ou fora da área visível. */
export function isOutsideVisibleArea(rect: Pick<DOMRect, 'top' | 'bottom'>, area: VisibleArea, margin = 16) {
  return rect.bottom > area.bottom - margin || rect.top < area.top + margin
}
