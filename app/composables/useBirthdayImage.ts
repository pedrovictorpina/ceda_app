import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { BIRTHDAY_IMAGE_FORMATS, paginateEvenly, type BirthdayImageFormat } from '~/utils/birthdayCardLayout'
import { CARD_FONTS, drawBirthdayCard, type BirthdayCardPerson } from '~/utils/birthdayCanvas'
import {
  birthdayPeriodRange,
  formatBirthdayPeriodRange,
  formatDayMonth,
  initialsOf,
  shortDisplayName,
  type BirthdayPeriod,
  type BirthdayPerson
} from '~/utils/birthdays'

export interface BirthdayImagePage {
  blob: Blob
  url: string
  fileName: string
}

export interface BirthdayImageRequest {
  format: BirthdayImageFormat
  period: BirthdayPeriod
  today: string
  people: readonly BirthdayPerson[]
  avatarUrls: Readonly<Record<string, string>>
}

export type ShareOutcome = 'shared' | 'cancelled' | 'unsupported'

const LOGO_SRC = '/brand/ceda-logo.png'
const IMAGE_TIMEOUT_MS = 8000
const FONT_TIMEOUT_MS = 3000
const TITLE_SUFFIX: Record<BirthdayPeriod, string> = { today: 'do dia', week: 'da semana', month: 'do mês' }
const FILE_PERIOD: Record<BirthdayPeriod, string> = { today: 'dia', week: 'semana', month: 'mes' }

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T) {
  return Promise.race([promise, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))])
}

/** crossOrigin="anonymous" evita "sujar" o canvas; se a foto falhar, a arte usa as iniciais. */
function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null)
  const loading = new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => resolve(null)
    image.src = src
  })
  return withTimeout(loading, IMAGE_TIMEOUT_MS, null)
}

async function ensureCardFonts() {
  if (typeof document === 'undefined' || !document.fonts) return
  const faces = [
    `700 120px ${CARD_FONTS.display}`,
    `italic 600 120px ${CARD_FONTS.display}`,
    `italic 500 40px ${CARD_FONTS.display}`,
    `800 40px ${CARD_FONTS.body}`,
    `700 40px ${CARD_FONTS.body}`,
    `600 40px ${CARD_FONTS.body}`,
    `500 40px ${CARD_FONTS.body}`
  ]
  const loading = Promise.all(faces.map(face => document.fonts.load(face).catch(() => [])))
  await withTimeout(loading, FONT_TIMEOUT_MS, [])
}

async function toCardPeople(request: BirthdayImageRequest): Promise<BirthdayCardPerson[]> {
  const images = await Promise.all(request.people.map(person => loadImage(request.avatarUrls[person.id])))
  return request.people.map((person, index) => ({
    name: shortDisplayName(person.fullName),
    initials: initialsOf(person.fullName),
    dateLabel: formatDayMonth(person.day, person.month),
    isToday: request.period !== 'today' && person.celebrationDate === request.today,
    image: images[index] ?? null
  }))
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.')), 'image/png')
  })
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler a imagem.'))
    reader.readAsDataURL(blob)
  })
}

function isNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Filesystem') && Capacitor.isPluginAvailable('Share')
}

async function shareNative(pages: readonly BirthdayImagePage[], title: string): Promise<ShareOutcome> {
  const files = await Promise.all(pages.map(async (page) => {
    const written = await Filesystem.writeFile({ path: page.fileName, data: await blobToBase64(page.blob), directory: Directory.Cache })
    return written.uri
  }))
  try {
    await Share.share({ title, files, dialogTitle: 'Compartilhar aniversariantes' })
    return 'shared'
  } catch {
    // O plugin rejeita quando a pessoa fecha a folha de compartilhamento.
    return 'cancelled'
  }
}

function isAbort(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function useBirthdayImage() {
  /** Gera uma ou mais artes (acima da capacidade do formato, divide em páginas equilibradas). */
  async function generate(request: BirthdayImageRequest): Promise<BirthdayImagePage[]> {
    const spec = BIRTHDAY_IMAGE_FORMATS[request.format]
    await ensureCardFonts()
    const [people, logo] = await Promise.all([toCardPeople(request), loadImage(LOGO_SRC)])
    const pages = paginateEvenly(people, spec.capacity)
    const subtitle = formatBirthdayPeriodRange(request.period, birthdayPeriodRange(request.period, request.today))
    const baseName = `aniversariantes-${FILE_PERIOD[request.period]}-${request.today}-${request.format === 'story' ? 'story' : '16x9'}`
    return Promise.all(pages.map(async (pagePeople, index) => {
      const canvas = document.createElement('canvas')
      canvas.width = spec.width
      canvas.height = spec.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Seu navegador não permite gerar imagens.')
      drawBirthdayCard(context, {
        format: request.format,
        titleSuffix: TITLE_SUFFIX[request.period],
        subtitle,
        people: pagePeople,
        page: { index, total: pages.length },
        logo
      })
      const blob = await canvasToBlob(canvas)
      const suffix = pages.length > 1 ? `-${index + 1}de${pages.length}` : ''
      return { blob, url: URL.createObjectURL(blob), fileName: `${baseName}${suffix}.png` }
    }))
  }

  function release(pages: readonly BirthdayImagePage[]) {
    pages.forEach(page => URL.revokeObjectURL(page.url))
  }

  function canShare() {
    if (isNativeApp()) return true
    if (typeof navigator === 'undefined' || !navigator.canShare) return false
    const probe = new File([new Blob()], 'teste.png', { type: 'image/png' })
    return navigator.canShare({ files: [probe] })
  }

  async function share(pages: readonly BirthdayImagePage[], title: string): Promise<ShareOutcome> {
    if (!pages.length) return 'unsupported'
    if (isNativeApp()) return shareNative(pages, title)
    const files = pages.map(page => new File([page.blob], page.fileName, { type: 'image/png' }))
    if (!navigator.canShare?.({ files })) return 'unsupported'
    try {
      await navigator.share({ files, title })
      return 'shared'
    } catch (error) {
      if (isAbort(error)) return 'cancelled'
      throw error
    }
  }

  /** No app nativo o WebView não baixa arquivos; a folha de compartilhamento permite salvar. */
  async function download(page: BirthdayImagePage, title: string): Promise<'downloaded' | ShareOutcome> {
    if (isNativeApp()) return shareNative([page], title)
    const link = document.createElement('a')
    link.href = page.url
    link.download = page.fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return 'downloaded'
  }

  return { generate, release, canShare, share, download }
}
