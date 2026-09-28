<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import QRCode from 'qrcode'

type InviteImageFormat = 'horizontal' | 'vertical'

interface InviteImageFormatOption {
  id: InviteImageFormat
  label: string
  description: string
  width: number
  height: number
}

interface GeneratedInviteImage {
  blob: Blob
  url: string
  fileName: string
}

const props = defineProps<{ inviteUrl: string }>()
const open = defineModel<boolean>('open', { required: true })

const formats: InviteImageFormatOption[] = [
  { id: 'horizontal', label: 'Horizontal', description: 'Ideal para WhatsApp e telas', width: 1600, height: 900 },
  { id: 'vertical', label: 'Vertical', description: 'Ideal para status e stories', width: 1080, height: 1350 }
]
const format = ref<InviteImageFormat>('horizontal')
const image = ref<GeneratedInviteImage | null>(null)
const generating = ref(false)
const busy = ref(false)
const failure = ref('')
const shareAvailable = ref(false)
let generation = 0

const selectedFormat = computed<InviteImageFormatOption>(() => formats.find(item => item.id === format.value) ?? formats[0]!)

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Não foi possível gerar a imagem.')), 'image/png')
  })
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = () => reject(reader.error || new Error('Não foi possível preparar a imagem.'))
    reader.readAsDataURL(blob)
  })
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  context.beginPath()
  context.roundRect(x, y, width, height, radius)
  context.fill()
}

function drawText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, font: string, color: string) {
  context.font = font
  context.fillStyle = color
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(text, x, y, maxWidth)
}

async function generate() {
  const current = ++generation
  generating.value = true
  failure.value = ''
  try {
    const spec = selectedFormat.value
    const canvas = document.createElement('canvas')
    canvas.width = spec.width
    canvas.height = spec.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas indisponível.')

    const vertical = spec.id === 'vertical'
    context.fillStyle = '#fffaf3'
    context.fillRect(0, 0, spec.width, spec.height)
    context.fillStyle = '#f97316'
    context.fillRect(0, 0, spec.width, vertical ? 270 : 220)
    context.fillStyle = 'rgba(255, 255, 255, 0.16)'
    context.beginPath()
    context.arc(vertical ? 930 : 1440, 80, vertical ? 260 : 200, 0, Math.PI * 2)
    context.fill()

    const cardWidth = vertical ? 840 : 580
    const cardHeight = vertical ? 840 : 620
    const cardX = (spec.width - cardWidth) / 2
    const cardY = vertical ? 330 : 140
    context.shadowColor = 'rgba(67, 20, 7, 0.16)'
    context.shadowBlur = 32
    context.shadowOffsetY = 12
    context.fillStyle = '#ffffff'
    roundRect(context, cardX, cardY, cardWidth, cardHeight, 42)
    context.shadowColor = 'transparent'

    drawText(context, 'CEDA', spec.width / 2, vertical ? 84 : 70, spec.width - 100, '800 52px Inter, Arial, sans-serif', '#ffffff')
    drawText(context, 'COMUNIDADE QUE ACOLHE', spec.width / 2, vertical ? 150 : 128, spec.width - 100, '700 22px Inter, Arial, sans-serif', 'rgba(255,255,255,0.88)')
    drawText(context, 'Venha fazer parte', spec.width / 2, cardY + (vertical ? 105 : 92), cardWidth - 100, '800 54px Inter, Arial, sans-serif', '#431407')
    drawText(context, 'Aponte a câmera para o QR Code e complete seu cadastro.', spec.width / 2, cardY + (vertical ? 170 : 150), cardWidth - 100, '500 26px Inter, Arial, sans-serif', '#6b3a1d')

    const qrCanvas = document.createElement('canvas')
    const qrSize = vertical ? 430 : 360
    await QRCode.toCanvas(qrCanvas, props.inviteUrl, {
      width: qrSize,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#431407', light: '#ffffff' }
    })
    const qrX = (spec.width - qrSize) / 2
    const qrY = vertical ? cardY + 235 : cardY + 205
    context.fillStyle = '#fffaf3'
    roundRect(context, qrX - 24, qrY - 24, qrSize + 48, qrSize + 48, 28)
    context.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)

    drawText(context, 'Cadastro completo pelo app ou navegador', spec.width / 2, vertical ? cardY + 745 : cardY + 610, cardWidth - 90, '600 22px Inter, Arial, sans-serif', '#6b3a1d')
    const inviteDomain = new URL(props.inviteUrl).host
    if (vertical) drawText(context, inviteDomain, spec.width / 2, 1260, spec.width - 100, '600 20px Inter, Arial, sans-serif', '#7c2d12')
    else drawText(context, inviteDomain, spec.width / 2, 820, spec.width - 100, '600 20px Inter, Arial, sans-serif', '#7c2d12')

    const blob = await canvasToBlob(canvas)
    if (current !== generation) return
    if (image.value) URL.revokeObjectURL(image.value.url)
    image.value = {
      blob,
      url: URL.createObjectURL(blob),
      fileName: `convite-ceda-${format.value}.png`
    }
  } catch {
    if (current === generation) failure.value = 'Não foi possível gerar a imagem neste aparelho. Tente novamente.'
  } finally {
    if (current === generation) generating.value = false
  }
}

function isNativeApp() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Filesystem') && Capacitor.isPluginAvailable('Share')
}

function canShareImage() {
  if (isNativeApp()) return true
  if (!navigator.canShare) return false
  return navigator.canShare({ files: [new File([new Blob()], 'convite.png', { type: 'image/png' })] })
}

async function shareImage() {
  if (!image.value) return
  busy.value = true
  try {
    if (isNativeApp()) {
      const written = await Filesystem.writeFile({
        path: image.value.fileName,
        data: await blobToBase64(image.value.blob),
        directory: Directory.Cache
      })
      await Share.share({ title: 'Convite CEDA', text: 'Complete seu cadastro para participar da CEDA.', files: [written.uri] })
    } else {
      const file = new File([image.value.blob], image.value.fileName, { type: 'image/png' })
      await navigator.share({ title: 'Convite CEDA', text: 'Complete seu cadastro para participar da CEDA.', files: [file] })
    }
  } catch {
    // Fechar a folha de compartilhamento não precisa de mensagem de erro.
  } finally {
    busy.value = false
  }
}

function downloadImage() {
  if (!image.value) return
  const link = document.createElement('a')
  link.href = image.value.url
  link.download = image.value.fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  link.remove()
}

watch([open, format], ([isOpen]) => {
  if (!isOpen) return
  shareAvailable.value = canShareImage()
  void generate()
})

watch(open, (isOpen) => {
  if (isOpen) return
  generation += 1
  if (image.value) URL.revokeObjectURL(image.value.url)
  image.value = null
})

onBeforeUnmount(() => image.value && URL.revokeObjectURL(image.value.url))
</script>

<template>
  <UModal
    v-model:open="open"
    title="Imagem de convite"
    description="A arte inclui um QR Code para o cadastro completo."
    :ui="{ content: 'max-w-2xl', body: 'space-y-4' }"
  >
    <template #body>
      <fieldset>
        <legend class="mb-2 text-sm font-semibold">
          Formato
        </legend>
        <div class="grid grid-cols-2 gap-2">
          <button
            v-for="item in formats"
            :key="item.id"
            type="button"
            class="focus-ring flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition"
            :class="format === item.id ? 'border-primary bg-primary/10 text-primary' : 'border-default hover:bg-elevated'"
            :aria-pressed="format === item.id"
            @click="format = item.id"
          >
            <span
              class="shrink-0 rounded-md border-2 border-current"
              :class="item.id === 'vertical' ? 'h-9 w-5' : 'h-5 w-9'"
              aria-hidden="true"
            />
            <span class="min-w-0">
              <span class="block font-semibold">{{ item.label }}</span>
              <span class="block text-xs text-muted">{{ item.description }}</span>
            </span>
          </button>
        </div>
      </fieldset>

      <div class="grid min-h-64 place-items-center overflow-hidden rounded-2xl border border-default bg-elevated/60 p-3">
        <BrandLoader
          v-if="generating"
          label="Preparando a arte…"
        />
        <UAlert
          v-else-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-image-off"
          :description="failure"
          :actions="[{ label: 'Tentar novamente', color: 'error', variant: 'soft', onClick: generate }]"
        />
        <img
          v-else-if="image"
          :src="image.url"
          :alt="`Convite CEDA em formato ${format}`"
          class="max-h-[52vh] w-auto rounded-xl shadow-lg"
          :class="format === 'vertical' ? 'aspect-[4/5]' : 'aspect-video'"
        >
      </div>
    </template>

    <template #footer>
      <div class="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <UButton
          v-if="shareAvailable"
          color="neutral"
          variant="outline"
          size="lg"
          icon="i-lucide-share-2"
          label="Compartilhar"
          class="justify-center"
          :disabled="!image || generating"
          :loading="busy"
          @click="shareImage"
        />
        <UButton
          size="lg"
          icon="i-lucide-download"
          label="Baixar imagem"
          class="justify-center"
          :disabled="!image || generating"
          @click="downloadImage"
        />
      </div>
    </template>
  </UModal>
</template>
