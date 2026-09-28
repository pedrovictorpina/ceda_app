export type BirthdayImageFormat = 'landscape' | 'story'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface BirthdayImageFormatSpec {
  id: BirthdayImageFormat
  label: string
  description: string
  width: number
  height: number
  /** Margens livres de conteúdo crítico (no story, a interface do Instagram cobre topo e base). */
  safe: { top: number, right: number, bottom: number, left: number }
  /** Máximo de pessoas por imagem antes de dividir em várias artes. */
  capacity: number
  maxAvatar: number
}

export const BIRTHDAY_IMAGE_FORMATS: Record<BirthdayImageFormat, BirthdayImageFormatSpec> = {
  landscape: {
    id: 'landscape',
    label: '16:9',
    description: '1920 × 1080 · telão e WhatsApp',
    width: 1920,
    height: 1080,
    safe: { top: 96, right: 112, bottom: 96, left: 112 },
    capacity: 12,
    maxAvatar: 360
  },
  story: {
    id: 'story',
    label: 'Story',
    description: '1080 × 1920 · Instagram e WhatsApp',
    width: 1080,
    height: 1920,
    safe: { top: 250, right: 80, bottom: 250, left: 80 },
    capacity: 12,
    maxAvatar: 400
  }
}

export interface BirthdayCardRegions {
  header: Rect
  grid: Rect
  footer: Rect
}

/**
 * Regiões da arte dentro da área segura. 16:9: título à esquerda e grade à direita.
 * Story: título no topo, grade no centro e bênção acima da faixa inferior.
 */
export function birthdayCardRegions(format: BirthdayImageFormat): BirthdayCardRegions {
  const spec = BIRTHDAY_IMAGE_FORMATS[format]
  const inner: Rect = {
    x: spec.safe.left,
    y: spec.safe.top,
    width: spec.width - spec.safe.left - spec.safe.right,
    height: spec.height - spec.safe.top - spec.safe.bottom
  }
  if (format === 'landscape') {
    const columnWidth = Math.round(inner.width * 0.42)
    const footerHeight = 150
    return {
      header: { x: inner.x, y: inner.y, width: columnWidth, height: inner.height - footerHeight },
      footer: { x: inner.x, y: inner.y + inner.height - footerHeight, width: columnWidth, height: footerHeight },
      grid: { x: inner.x + columnWidth + 64, y: inner.y, width: inner.width - columnWidth - 64, height: inner.height }
    }
  }
  const headerHeight = 470
  const footerHeight = 150
  return {
    header: { x: inner.x, y: inner.y, width: inner.width, height: headerHeight },
    grid: { x: inner.x, y: inner.y + headerHeight + 24, width: inner.width, height: inner.height - headerHeight - footerHeight - 48 },
    footer: { x: inner.x, y: inner.y + inner.height - footerHeight, width: inner.width, height: footerHeight }
  }
}

export interface GridLayout {
  columns: number
  rows: number
  avatar: number
  cellWidth: number
  cellHeight: number
  gap: number
  /** Altura reservada ao nome e à data, proporcional ao avatar. */
  labelHeight: number
}

/** Espaço de legenda (nome + data) em relação ao diâmetro do avatar, com um mínimo legível. */
export const LABEL_RATIO = 0.62
export const MIN_LABEL_HEIGHT = 120
const AVATAR_WIDTH_RATIO = 0.8

export function labelHeightFor(avatar: number, minLabel = MIN_LABEL_HEIGHT) {
  return Math.round(Math.max(avatar * LABEL_RATIO, minLabel))
}

/** Maior avatar cuja legenda ainda cabe na altura da célula. */
function avatarForHeight(cellHeight: number, minLabel: number) {
  const proportional = cellHeight / (1 + LABEL_RATIO)
  return proportional * LABEL_RATIO >= minLabel ? proportional : cellHeight - minLabel
}

export interface GridOptions {
  gap?: number
  maxAvatar?: number
  minLabel?: number
}

/** Escolhe o número de colunas que produz o maior avatar para caber `count` pessoas na área. */
export function computeGrid(count: number, area: Pick<Rect, 'width' | 'height'>, options: GridOptions = {}): GridLayout {
  const gap = options.gap ?? 36
  const maxAvatar = options.maxAvatar ?? Number.POSITIVE_INFINITY
  const minLabel = options.minLabel ?? MIN_LABEL_HEIGHT
  const total = Math.max(1, Math.floor(count))
  let best: GridLayout | null = null
  for (let columns = 1; columns <= total; columns += 1) {
    const rows = Math.ceil(total / columns)
    const cellWidth = (area.width - gap * (columns - 1)) / columns
    const cellHeight = (area.height - gap * (rows - 1)) / rows
    const avatar = Math.floor(Math.min(cellWidth * AVATAR_WIDTH_RATIO, avatarForHeight(cellHeight, minLabel), maxAvatar))
    if (avatar <= 0) continue
    if (!best || avatar > best.avatar) {
      best = { columns, rows, avatar, cellWidth, cellHeight, gap, labelHeight: labelHeightFor(avatar, minLabel) }
    }
  }
  return best ?? { columns: 1, rows: 1, avatar: 0, cellWidth: area.width, cellHeight: area.height, gap, labelHeight: 0 }
}

export interface CellPosition {
  /** Centro horizontal do avatar. */
  centerX: number
  /** Topo do bloco avatar + legenda. */
  top: number
}

/** Posições das pessoas: bloco centralizado na área e última linha incompleta centralizada. */
export function gridCellPositions(count: number, grid: GridLayout, area: Rect): CellPosition[] {
  const blockHeight = grid.avatar + grid.labelHeight
  const usedHeight = grid.rows * blockHeight + (grid.rows - 1) * grid.gap
  const rowStep = blockHeight + grid.gap
  const top = area.y + (area.height - usedHeight) / 2
  return Array.from({ length: Math.max(0, count) }, (_, index) => {
    const row = Math.floor(index / grid.columns)
    const column = index % grid.columns
    const itemsInRow = Math.min(grid.columns, count - row * grid.columns)
    const rowWidth = itemsInRow * grid.cellWidth + (itemsInRow - 1) * grid.gap
    const left = area.x + (area.width - rowWidth) / 2
    return {
      centerX: left + column * (grid.cellWidth + grid.gap) + grid.cellWidth / 2,
      top: top + row * rowStep
    }
  })
}

/** Divide em páginas equilibradas (13 pessoas com limite 12 viram 7 + 6, não 12 + 1). */
export function paginateEvenly<T>(items: readonly T[], capacity: number): T[][] {
  if (!items.length) return []
  const size = Math.max(1, Math.floor(capacity))
  const pages = Math.ceil(items.length / size)
  const perPage = Math.ceil(items.length / pages)
  return Array.from({ length: pages }, (_, page) => items.slice(page * perPage, (page + 1) * perPage))
}

export type MeasureText = (text: string, fontSize: number) => number

/** Maior fonte (entre min e max) em que o texto cabe na largura. */
export function fitFontSize(text: string, maxWidth: number, measure: MeasureText, max: number, min: number) {
  const floor = Math.min(min, max)
  for (let size = Math.floor(max); size > floor; size -= 1) {
    if (measure(text, size) <= maxWidth) return size
  }
  return floor
}

/** Corta o texto com reticências até caber na largura. */
export function truncateToWidth(text: string, maxWidth: number, measure: MeasureText, fontSize: number) {
  if (measure(text, fontSize) <= maxWidth) return text
  const characters = Array.from(text)
  for (let length = characters.length - 1; length > 0; length -= 1) {
    const candidate = `${characters.slice(0, length).join('').trimEnd()}…`
    if (measure(candidate, fontSize) <= maxWidth) return candidate
  }
  return '…'
}

/** Nome que cabe na célula: nome curto; se não couber, só o primeiro nome; por fim, reticências. */
export function fitNameToWidth(name: string, maxWidth: number, measure: MeasureText, fontSize: number) {
  if (measure(name, fontSize) <= maxWidth) return name
  const firstName = name.split(/\s+/)[0] ?? name
  return truncateToWidth(firstName, maxWidth, measure, fontSize)
}
