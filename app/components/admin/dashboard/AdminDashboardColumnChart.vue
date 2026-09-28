<script setup lang="ts">
import { formatCount } from '~/utils/adminDashboard'
import { axisTicks, peakPoint, type SeriesPoint } from '~/utils/adminDashboardDates'

const props = withDefaults(defineProps<{
  points: SeriesPoint[]
  /** Texto alternativo completo do gráfico (leitores de tela). */
  summary: string
  format?: (value: number) => string
  axisFormat?: (value: number) => string
  integer?: boolean
}>(), {
  format: (value: number) => formatCount(value),
  axisFormat: undefined,
  integer: true
})

const PLOT_HEIGHT = 156
const TOP_GAP = 18
const AXIS_BAND = 26
const RIGHT_GUTTER = 4
const MAX_BAR = 24
const MIN_LABEL_SPACING = 44

const container = ref<HTMLElement | null>(null)
const width = ref(320)
const active = ref<number | null>(null)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  width.value = Math.max(240, Math.round(container.value.clientWidth))
  observer = new ResizeObserver(([entry]) => {
    if (entry) width.value = Math.max(240, Math.round(entry.contentRect.width))
  })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

const height = PLOT_HEIGHT + TOP_GAP + AXIS_BAND
const baseline = TOP_GAP + PLOT_HEIGHT
const ticks = computed(() => axisTicks(Math.max(0, ...props.points.map(point => point.value)), props.integer))
const axisLabel = computed(() => props.axisFormat ?? props.format)
// Calha do eixo Y medida pelo rótulo mais longo (~6,6px por caractere a 11px).
const LEFT_GUTTER_MIN = 28
const leftGutter = computed(() => Math.max(LEFT_GUTTER_MIN, ...ticks.value.map(tick => Math.ceil(axisLabel.value(tick).length * 6.6) + 12)))
const plotWidth = computed(() => width.value - leftGutter.value - RIGHT_GUTTER)
const band = computed(() => plotWidth.value / Math.max(1, props.points.length))
const barWidth = computed(() => Math.min(MAX_BAR, Math.max(4, band.value * 0.62)))
const ceiling = computed(() => ticks.value.at(-1) || 1)
const labelEvery = computed(() => Math.max(1, Math.ceil(MIN_LABEL_SPACING / band.value)))
const peakKey = computed(() => peakPoint(props.points)?.key)
function tickY(value: number) {
  return baseline - (value / ceiling.value) * PLOT_HEIGHT
}

/** Coluna com cantos de 4px no topo e base reta sobre a linha de base. */
function columnPath(x: number, y: number, w: number, h: number) {
  if (h <= 0) return ''
  const r = Math.min(4, h, w / 2)
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
}

const bars = computed(() => props.points.map((point, index) => {
  const h = (point.value / ceiling.value) * PLOT_HEIGHT
  const slot = leftGutter.value + index * band.value
  const x = slot + (band.value - barWidth.value) / 2
  return {
    ...point,
    index,
    slot,
    center: slot + band.value / 2,
    top: baseline - h,
    path: columnPath(x, baseline - h, barWidth.value, h),
    showLabel: (props.points.length - 1 - index) % labelEvery.value === 0,
    isPeak: point.key === peakKey.value
  }
}))

const activeBar = computed(() => (active.value === null ? null : bars.value[active.value] ?? null))
/** A dica fica ao lado da coluna ativa (nunca sobre ela) e dentro do cartão. */
const tooltipStyle = computed(() => {
  const bar = activeBar.value
  if (!bar) return {}
  const onRight = bar.index < props.points.length / 2
  const offset = band.value / 2 + 6
  return onRight
    ? { left: `${bar.center + offset}px`, top: `${TOP_GAP}px` }
    : { left: `${bar.center - offset}px`, top: `${TOP_GAP}px`, transform: 'translateX(-100%)' }
})
const liveText = computed(() => (activeBar.value ? `${activeBar.value.fullLabel}: ${props.format(activeBar.value.value)}` : ''))

function indexFromPointer(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * width.value
  const index = Math.floor((x - leftGutter.value) / band.value)
  return Math.min(Math.max(index, 0), props.points.length - 1)
}

function onPointer(event: PointerEvent) {
  if (props.points.length) active.value = indexFromPointer(event)
}

function onLeave(event: PointerEvent) {
  if (event.pointerType === 'mouse') active.value = null
}

function onKeydown(event: KeyboardEvent) {
  const last = props.points.length - 1
  const current = active.value ?? last
  const moves: Record<string, number> = { ArrowLeft: current - 1, ArrowRight: current + 1, Home: 0, End: last }
  const next = moves[event.key]
  if (next === undefined) return
  event.preventDefault()
  active.value = Math.min(Math.max(next, 0), last)
}
</script>

<template>
  <div
    ref="container"
    class="relative w-full"
  >
    <svg
      :width="width"
      :height="height"
      :viewBox="`0 0 ${width} ${height}`"
      class="block max-w-full touch-pan-y select-none outline-none focus-visible:rounded-lg focus-visible:ring-2 focus-visible:ring-primary"
      role="img"
      tabindex="0"
      :aria-label="`${summary} Use as setas para percorrer os valores.`"
      @pointermove="onPointer"
      @pointerdown="onPointer"
      @pointerleave="onLeave"
      @focus="active = active ?? points.length - 1"
      @blur="active = null"
      @keydown="onKeydown"
    >
      <g aria-hidden="true">
        <rect
          v-if="activeBar"
          :x="activeBar.slot + 1"
          :y="TOP_GAP"
          :width="Math.max(0, band - 2)"
          :height="PLOT_HEIGHT"
          rx="6"
          fill="var(--viz-hover)"
        />
        <g
          v-for="tick in ticks"
          :key="tick"
        >
          <line
            :x1="leftGutter"
            :x2="width - RIGHT_GUTTER"
            :y1="tickY(tick)"
            :y2="tickY(tick)"
            :stroke="tick === 0 ? 'var(--viz-baseline)' : 'var(--viz-grid)'"
            stroke-width="1"
            shape-rendering="crispEdges"
          />
          <text
            :x="leftGutter - 8"
            :y="tickY(tick)"
            text-anchor="end"
            dominant-baseline="middle"
            class="fill-current text-[11px] tabular-nums text-muted"
          >{{ axisLabel(tick) }}</text>
        </g>
        <g
          v-for="bar in bars"
          :key="bar.key"
        >
          <path
            v-if="bar.path"
            :d="bar.path"
            fill="var(--viz-mark)"
            :fill-opacity="active === null || active === bar.index ? 1 : 0.55"
          />
          <text
            v-if="bar.isPeak && active === null"
            :x="bar.center"
            :y="bar.top - 6"
            text-anchor="middle"
            class="fill-current text-[11px] font-semibold text-highlighted"
          >{{ format(bar.value) }}</text>
          <text
            v-if="bar.showLabel"
            :x="bar.center"
            :y="baseline + 17"
            text-anchor="middle"
            class="fill-current text-[11px] tabular-nums text-muted"
          >{{ bar.label }}</text>
        </g>
      </g>
    </svg>

    <div
      v-if="activeBar"
      class="pointer-events-none absolute z-10 whitespace-nowrap rounded-xl border border-default bg-default px-3 py-2 shadow-lg"
      :style="tooltipStyle"
      aria-hidden="true"
    >
      <p class="text-sm font-semibold text-highlighted">
        {{ format(activeBar.value) }}
      </p>
      <p class="text-xs text-muted">
        {{ activeBar.fullLabel }}
      </p>
    </div>
    <p
      class="sr-only"
      aria-live="polite"
    >
      {{ liveText }}
    </p>
  </div>
</template>
