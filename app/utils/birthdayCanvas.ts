import {
  BIRTHDAY_IMAGE_FORMATS,
  birthdayCardRegions,
  computeGrid,
  fitFontSize,
  fitNameToWidth,
  gridCellPositions,
  type BirthdayImageFormat,
  type BirthdayImageFormatSpec,
  type GridLayout,
  type MeasureText,
  type Rect
} from './birthdayCardLayout'

export interface BirthdayCardPerson {
  name: string
  initials: string
  dateLabel: string
  /** Marca "Hoje" sobre o avatar (usado nas artes da semana e do mês). */
  isToday: boolean
  image: CanvasImageSource | null
}

export interface BirthdayCardContent {
  format: BirthdayImageFormat
  /** Complemento do título: "do dia", "da semana", "do mês". */
  titleSuffix: string
  subtitle: string
  people: BirthdayCardPerson[]
  page: { index: number, total: number }
  logo: CanvasImageSource | null
}

export const CARD_FONTS = {
  display: '"Fraunces", Georgia, "Times New Roman", serif',
  body: 'Inter, ui-sans-serif, system-ui, sans-serif'
} as const

const COLORS = {
  paper: '#fffaf3',
  paperDeep: '#ffe8cc',
  ink: '#431407',
  inkSoft: 'rgba(67, 20, 7, 0.72)',
  primary: '#f97316',
  primaryDeep: '#c2410c',
  pill: 'rgba(249, 115, 22, 0.13)',
  confetti: ['#f97316', '#fb923c', '#fbbf24', '#fda4af', '#fdba74', '#ea580c']
} as const

const BLESSING = '“O Senhor te abençoe e te guarde.”'
const BLESSING_REFERENCE = 'Números 6.24'

type Ctx = CanvasRenderingContext2D

function font(weight: number, size: number, family: string, italic = false) {
  return `${italic ? 'italic ' : ''}${weight} ${Math.round(size)}px ${family}`
}

function measurer(ctx: Ctx, weight: number, family: string, italic = false): MeasureText {
  return (text, size) => {
    ctx.font = font(weight, size, family, italic)
    return ctx.measureText(text).width
  }
}

function setLetterSpacing(ctx: Ctx, value: string) {
  if ('letterSpacing' in ctx) (ctx as Ctx & { letterSpacing: string }).letterSpacing = value
}

/** Gerador determinístico: a prévia não "pula" a cada nova renderização. */
function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function roundedRect(ctx: Ctx, rect: Rect, radius: number) {
  ctx.beginPath()
  ctx.roundRect(rect.x, rect.y, rect.width, rect.height, radius)
}

function drawBackground(ctx: Ctx, spec: BirthdayImageFormatSpec) {
  const base = ctx.createLinearGradient(0, 0, spec.width, spec.height)
  base.addColorStop(0, COLORS.paper)
  base.addColorStop(1, COLORS.paperDeep)
  ctx.fillStyle = base
  ctx.fillRect(0, 0, spec.width, spec.height)

  const glowX = spec.id === 'landscape' ? spec.width * 0.7 : spec.width / 2
  const glowY = spec.id === 'landscape' ? spec.height * 0.5 : spec.height * 0.58
  const glow = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, Math.max(spec.width, spec.height) * 0.55)
  glow.addColorStop(0, 'rgba(251, 146, 60, 0.30)')
  glow.addColorStop(1, 'rgba(251, 146, 60, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, spec.width, spec.height)
  drawSunRays(ctx, glowX, glowY, Math.max(spec.width, spec.height))
}

function drawSunRays(ctx: Ctx, x: number, y: number, length: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = 'rgba(249, 115, 22, 0.05)'
  const rays = 18
  for (let index = 0; index < rays; index += 1) {
    ctx.rotate((Math.PI * 2) / rays)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(length, -length * 0.06)
    ctx.lineTo(length, length * 0.06)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

/** Confetes só nas bordas, longe dos nomes e rostos. */
function drawConfetti(ctx: Ctx, spec: BirthdayImageFormatSpec, seed: number) {
  const random = seededRandom(seed)
  const pieces = spec.id === 'landscape' ? 70 : 80
  const band = spec.id === 'landscape' ? 110 : 150
  for (let index = 0; index < pieces; index += 1) {
    const edge = index % 4
    const along = random()
    const across = random() * band
    const x = edge === 0 || edge === 2 ? along * spec.width : edge === 1 ? spec.width - across : across
    const y = edge === 1 || edge === 3 ? along * spec.height : edge === 0 ? across : spec.height - across
    drawConfettiPiece(ctx, x, y, random)
  }
}

function drawConfettiPiece(ctx: Ctx, x: number, y: number, random: () => number) {
  const color = COLORS.confetti[Math.floor(random() * COLORS.confetti.length)] ?? COLORS.primary
  const size = 8 + random() * 14
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(random() * Math.PI)
  ctx.globalAlpha = 0.45 + random() * 0.45
  ctx.fillStyle = color
  if (random() > 0.55) {
    ctx.beginPath()
    ctx.arc(0, 0, size / 2.4, 0, Math.PI * 2)
    ctx.fill()
  } else {
    roundedRect(ctx, { x: -size / 2, y: -size / 5, width: size, height: size / 2.5 }, size / 6)
    ctx.fill()
  }
  ctx.restore()
}

function drawLogo(ctx: Ctx, logo: CanvasImageSource | null, x: number, y: number, size: number) {
  ctx.save()
  ctx.shadowColor = 'rgba(194, 65, 12, 0.25)'
  ctx.shadowBlur = size * 0.25
  ctx.shadowOffsetY = size * 0.06
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.primary
  ctx.fill()
  ctx.restore()
  if (!logo) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(logo, x, y, size, size)
  ctx.restore()
}

function drawBrand(ctx: Ctx, logo: CanvasImageSource | null, x: number, y: number, align: 'left' | 'center', size: number) {
  ctx.font = font(800, size * 0.44, CARD_FONTS.body)
  setLetterSpacing(ctx, '6px')
  const wordWidth = ctx.measureText('CEDA').width
  const totalWidth = size + size * 0.24 + wordWidth
  const startX = align === 'center' ? x - totalWidth / 2 : x
  drawLogo(ctx, logo, startX, y, size)
  ctx.fillStyle = COLORS.ink
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('CEDA', startX + size * 1.24, y + size / 2 + 2)
  setLetterSpacing(ctx, '0px')
  return y + size
}

interface HeaderLayout {
  align: 'left' | 'center'
  anchorX: number
  titleMax: number
  brandSize: number
  afterBrand: number
}

function headerLayout(format: BirthdayImageFormat, region: Rect): HeaderLayout {
  return format === 'landscape'
    ? { align: 'left', anchorX: region.x, titleMax: 150, brandSize: 92, afterBrand: 96 }
    : { align: 'center', anchorX: region.x + region.width / 2, titleMax: 136, brandSize: 72, afterBrand: 44 }
}

function drawHeader(ctx: Ctx, region: Rect, content: BirthdayCardContent) {
  const layout = headerLayout(content.format, region)
  let cursor = drawBrand(ctx, content.logo, layout.anchorX, region.y, layout.align, layout.brandSize)
  cursor += layout.afterBrand

  ctx.textAlign = layout.align
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.primaryDeep
  ctx.font = font(700, 28, CARD_FONTS.body)
  setLetterSpacing(ctx, '5px')
  cursor += 28
  ctx.fillText('COM ALEGRIA, CELEBRAMOS', layout.anchorX, cursor)
  setLetterSpacing(ctx, '0px')

  const titleSize = fitFontSize('Aniversariantes', region.width, measurer(ctx, 700, CARD_FONTS.display), layout.titleMax, 72)
  cursor += titleSize * 1.05
  ctx.fillStyle = COLORS.ink
  ctx.font = font(700, titleSize, CARD_FONTS.display)
  ctx.fillText('Aniversariantes', layout.anchorX, cursor)

  const suffixSize = Math.round(titleSize * 0.78)
  cursor += suffixSize * 1.08
  ctx.fillStyle = COLORS.primary
  ctx.font = font(600, suffixSize, CARD_FONTS.display, true)
  ctx.fillText(content.titleSuffix, layout.anchorX, cursor)

  cursor += 34 + 30
  ctx.fillStyle = COLORS.inkSoft
  const subtitleSize = fitFontSize(content.subtitle, region.width, measurer(ctx, 500, CARD_FONTS.body), 38, 26)
  ctx.font = font(500, subtitleSize, CARD_FONTS.body)
  ctx.fillText(content.subtitle, layout.anchorX, cursor)
  drawAccentRule(ctx, layout, cursor + 36)
}

function drawAccentRule(ctx: Ctx, layout: HeaderLayout, y: number) {
  const width = 120
  const x = layout.align === 'center' ? layout.anchorX - width / 2 : layout.anchorX
  roundedRect(ctx, { x, y, width, height: 8 }, 4)
  ctx.fillStyle = COLORS.primary
  ctx.fill()
}

function drawFooter(ctx: Ctx, region: Rect, content: BirthdayCardContent) {
  const center = content.format === 'story'
  const x = center ? region.x + region.width / 2 : region.x
  ctx.textAlign = center ? 'center' : 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.ink
  ctx.font = font(500, 40, CARD_FONTS.display, true)
  const blessingSize = fitFontSize(BLESSING, region.width, measurer(ctx, 500, CARD_FONTS.display, true), 44, 30)
  ctx.font = font(500, blessingSize, CARD_FONTS.display, true)
  ctx.fillText(BLESSING, x, region.y + region.height - 70)
  ctx.fillStyle = COLORS.primaryDeep
  ctx.font = font(600, 26, CARD_FONTS.body)
  const reference = content.page.total > 1
    ? `${BLESSING_REFERENCE}  ·  ${content.page.index + 1}/${content.page.total}`
    : BLESSING_REFERENCE
  ctx.fillText(reference, x, region.y + region.height - 22)
}

function drawImageCover(ctx: Ctx, image: CanvasImageSource, x: number, y: number, size: number) {
  const source = image as { naturalWidth?: number, naturalHeight?: number, width?: number, height?: number }
  const width = Number(source.naturalWidth || source.width || size)
  const height = Number(source.naturalHeight || source.height || size)
  const side = Math.min(width, height)
  ctx.drawImage(image, (width - side) / 2, (height - side) / 2, side, side, x, y, size, size)
}

function drawInitials(ctx: Ctx, initials: string, cx: number, cy: number, radius: number) {
  const fill = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius)
  fill.addColorStop(0, '#fdba74')
  fill.addColorStop(1, '#ea580c')
  ctx.fillStyle = fill
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = font(600, radius * 0.78, CARD_FONTS.display)
  ctx.fillText(initials, cx, cy + radius * 0.04)
}

function drawAvatar(ctx: Ctx, person: BirthdayCardPerson, cx: number, cy: number, diameter: number) {
  const radius = diameter / 2
  const ring = Math.max(6, diameter * 0.05)
  ctx.save()
  ctx.shadowColor = 'rgba(154, 52, 18, 0.28)'
  ctx.shadowBlur = diameter * 0.12
  ctx.shadowOffsetY = diameter * 0.04
  ctx.beginPath()
  ctx.arc(cx, cy, radius + ring, 0, Math.PI * 2)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.restore()

  ctx.beginPath()
  ctx.arc(cx, cy, radius + ring, 0, Math.PI * 2)
  ctx.lineWidth = Math.max(3, ring * 0.45)
  ctx.strokeStyle = COLORS.primary
  ctx.stroke()

  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.clip()
  if (person.image) drawImageCover(ctx, person.image, cx - radius, cy - radius, diameter)
  else drawInitials(ctx, person.initials, cx, cy, radius)
  ctx.restore()
  if (person.isToday) drawTodayBadge(ctx, cx, cy + radius + ring * 0.3, diameter)
}

function drawTodayBadge(ctx: Ctx, cx: number, y: number, diameter: number) {
  const size = Math.max(22, diameter * 0.12)
  ctx.font = font(800, size, CARD_FONTS.body)
  setLetterSpacing(ctx, '2px')
  const width = ctx.measureText('HOJE').width + size * 1.4
  const height = size * 1.6
  roundedRect(ctx, { x: cx - width / 2, y: y - height / 2, width, height }, height / 2)
  ctx.fillStyle = COLORS.primary
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('HOJE', cx, y + 1)
  setLetterSpacing(ctx, '0px')
}

/** Mesmo tamanho de nome para toda a grade (o maior que caiba em todos, com piso legível). */
function sharedNameSize(ctx: Ctx, people: BirthdayCardPerson[], grid: GridLayout) {
  const measure = measurer(ctx, 700, CARD_FONTS.body)
  const max = Math.min(56, Math.max(30, grid.avatar * 0.17))
  return Math.min(...people.map(person => fitFontSize(person.name, grid.cellWidth - 8, measure, max, 27)))
}

function drawPersonLabel(ctx: Ctx, person: BirthdayCardPerson, cx: number, top: number, grid: GridLayout, nameSize: number) {
  const maxWidth = grid.cellWidth - 8
  const name = fitNameToWidth(person.name, maxWidth, measurer(ctx, 700, CARD_FONTS.body), nameSize)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = COLORS.ink
  ctx.font = font(700, nameSize, CARD_FONTS.body)
  const nameBaseline = top + nameSize * 1.1
  ctx.fillText(name, cx, nameBaseline)

  const dateSize = Math.round(nameSize * 0.72)
  ctx.font = font(600, dateSize, CARD_FONTS.body)
  const dateWidth = Math.min(maxWidth, ctx.measureText(person.dateLabel).width + dateSize * 1.4)
  const pillHeight = dateSize * 1.75
  const pillTop = nameBaseline + nameSize * 0.42
  roundedRect(ctx, { x: cx - dateWidth / 2, y: pillTop, width: dateWidth, height: pillHeight }, pillHeight / 2)
  ctx.fillStyle = COLORS.pill
  ctx.fill()
  ctx.fillStyle = COLORS.primaryDeep
  ctx.textBaseline = 'middle'
  ctx.fillText(person.dateLabel, cx, pillTop + pillHeight / 2 + 1)
}

function drawPeople(ctx: Ctx, region: Rect, people: BirthdayCardPerson[], spec: BirthdayImageFormatSpec) {
  const grid = computeGrid(people.length, region, { maxAvatar: spec.maxAvatar, gap: spec.id === 'story' ? 32 : 40 })
  const positions = gridCellPositions(people.length, grid, region)
  const nameSize = sharedNameSize(ctx, people, grid)
  people.forEach((person, index) => {
    const position = positions[index]
    if (!position) return
    const ring = Math.max(6, grid.avatar * 0.05)
    drawAvatar(ctx, person, position.centerX, position.top + ring + grid.avatar / 2, grid.avatar)
    drawPersonLabel(ctx, person, position.centerX, position.top + grid.avatar + ring * 2 + 14, grid, nameSize)
  })
}

/** Desenha uma arte completa no contexto (o canvas precisa ter o tamanho do formato). */
export function drawBirthdayCard(ctx: Ctx, content: BirthdayCardContent) {
  const spec = BIRTHDAY_IMAGE_FORMATS[content.format]
  const regions = birthdayCardRegions(content.format)
  ctx.save()
  drawBackground(ctx, spec)
  drawConfetti(ctx, spec, 20260929 + content.page.index * 7)
  drawHeader(ctx, regions.header, content)
  drawPeople(ctx, regions.grid, content.people, spec)
  drawFooter(ctx, regions.footer, content)
  ctx.restore()
}
