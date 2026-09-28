<script setup lang="ts">
import { BIRTHDAY_IMAGE_FORMATS, type BirthdayImageFormat } from '~/utils/birthdayCardLayout'
import { birthdayPeriodRange, birthdayPeriodTitles, formatBirthdayPeriodRange, type BirthdayPeriod, type BirthdayPerson } from '~/utils/birthdays'
import type { BirthdayImagePage } from '~/composables/useBirthdayImage'

const props = defineProps<{
  period: BirthdayPeriod
  today: string
  people: readonly BirthdayPerson[]
  avatarUrls: Readonly<Record<string, string>>
}>()
const open = defineModel<boolean>('open', { required: true })

const toast = useToast()
const image = useBirthdayImage()
const format = ref<BirthdayImageFormat>('story')
const pages = ref<BirthdayImagePage[]>([])
const pageIndex = ref(0)
const generating = ref(false)
const busy = ref(false)
const failure = ref('')
const shareAvailable = ref(false)
let generation = 0

const formats = Object.values(BIRTHDAY_IMAGE_FORMATS)
const title = computed(() => birthdayPeriodTitles[props.period])
const subtitle = computed(() => formatBirthdayPeriodRange(props.period, birthdayPeriodRange(props.period, props.today)))
const currentPage = computed(() => pages.value[pageIndex.value])

function replacePages(next: BirthdayImagePage[]) {
  image.release(pages.value)
  pages.value = next
  pageIndex.value = 0
}

async function render() {
  const current = ++generation
  generating.value = true
  failure.value = ''
  try {
    const next = await image.generate({ format: format.value, period: props.period, today: props.today, people: props.people, avatarUrls: props.avatarUrls })
    if (current !== generation) return image.release(next)
    replacePages(next)
  } catch {
    if (current === generation) failure.value = 'Não foi possível gerar a imagem neste aparelho. Tente novamente.'
  } finally {
    if (current === generation) generating.value = false
  }
}

async function downloadAll() {
  busy.value = true
  try {
    let downloaded = false
    for (const page of pages.value) {
      const outcome = await image.download(page, title.value)
      if (outcome === 'cancelled') break
      downloaded = downloaded || outcome === 'downloaded'
    }
    if (downloaded) {
      toast.add({ title: pages.value.length > 1 ? 'Imagens baixadas' : 'Imagem baixada', description: 'Confira na pasta de downloads do aparelho.', color: 'success', icon: 'i-lucide-download' })
    }
  } catch {
    toast.add({ title: 'Não foi possível baixar', description: 'Tente novamente em instantes.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}

async function shareAll() {
  busy.value = true
  try {
    const outcome = await image.share(pages.value, `${title.value} · CEDA`)
    if (outcome === 'unsupported') {
      toast.add({ title: 'Compartilhamento indisponível', description: 'Baixe a imagem e envie pelo aplicativo que preferir.', color: 'warning', icon: 'i-lucide-share-2' })
    }
  } catch {
    toast.add({ title: 'Não foi possível compartilhar', description: 'Baixe a imagem e envie pelo aplicativo que preferir.', color: 'error', icon: 'i-lucide-circle-alert' })
  } finally {
    busy.value = false
  }
}

watch([open, format], ([isOpen]) => {
  if (!isOpen) return
  shareAvailable.value = image.canShare()
  void render()
})

watch(open, (isOpen) => {
  if (isOpen) return
  generation += 1
  replacePages([])
})

onBeforeUnmount(() => image.release(pages.value))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="`Imagem: ${title.toLowerCase()}`"
    :description="subtitle"
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
              :class="item.id === 'story' ? 'h-9 w-5' : 'h-5 w-9'"
              aria-hidden="true"
            />
            <span class="min-w-0">
              <span class="block font-semibold">{{ item.label }}</span>
              <span class="block text-xs text-muted">{{ item.description }}</span>
            </span>
          </button>
        </div>
      </fieldset>

      <div
        class="relative grid min-h-64 place-items-center overflow-hidden rounded-2xl border border-default bg-elevated/60 p-3"
        aria-live="polite"
      >
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
          :actions="[{ label: 'Tentar novamente', color: 'error', variant: 'soft', onClick: render }]"
        />
        <img
          v-else-if="currentPage"
          :src="currentPage.url"
          :alt="`Prévia: ${title} (${subtitle})`"
          class="max-h-[52vh] w-auto rounded-xl shadow-lg"
          :class="format === 'story' ? 'aspect-[9/16]' : 'aspect-video'"
        >
      </div>

      <div
        v-if="pages.length > 1 && !generating"
        class="flex items-center justify-between gap-2"
      >
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-left"
          aria-label="Imagem anterior"
          class="size-11 justify-center"
          :disabled="pageIndex === 0"
          @click="pageIndex -= 1"
        />
        <p class="text-center text-sm text-muted">
          Imagem {{ pageIndex + 1 }} de {{ pages.length }}. Dividimos para manter nomes e fotos legíveis.
        </p>
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-chevron-right"
          aria-label="Próxima imagem"
          class="size-11 justify-center"
          :disabled="pageIndex >= pages.length - 1"
          @click="pageIndex += 1"
        />
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
          :disabled="!pages.length || generating"
          :loading="busy"
          @click="shareAll"
        />
        <UButton
          size="lg"
          icon="i-lucide-download"
          :label="pages.length > 1 ? 'Baixar imagens' : 'Baixar imagem'"
          class="justify-center"
          :disabled="!pages.length || generating"
          :loading="busy"
          @click="downloadAll"
        />
      </div>
    </template>
  </UModal>
</template>
