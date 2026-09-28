<script setup lang="ts">
import type { SectionStatus, TileTone } from '~/utils/adminDashboard'

const props = withDefaults(defineProps<{
  label: string
  icon: string
  status: SectionStatus
  value?: string
  /** Linha de apoio: variação, contexto ou mensagem de indisponibilidade. */
  detail?: string
  tone?: TileTone
  to?: string
  message?: string
  refreshing?: boolean
}>(), {
  value: '—',
  detail: '',
  tone: 'neutral',
  to: undefined,
  message: '',
  refreshing: false
})

const toneIcon: Record<TileTone, string> = {
  success: 'i-lucide-trending-up',
  error: 'i-lucide-trending-down',
  warning: 'i-lucide-circle-alert',
  neutral: ''
}

// Os tokens 500 de status ficam abaixo de 4,5:1 como texto no fundo claro;
// o texto usa o passo 700 (claro) / 400 (escuro) e o ícone reforça o sentido.
const toneClass: Record<TileTone, string> = {
  success: 'text-green-700 dark:text-green-400',
  error: 'text-red-700 dark:text-red-400',
  warning: 'text-amber-700 dark:text-amber-400',
  neutral: 'text-muted'
}

const failed = computed(() => props.status === 'error' || props.status === 'unavailable')
const shownValue = computed(() => (failed.value ? '—' : props.value))
const shownDetail = computed(() => (failed.value ? props.message : props.detail))
const shownTone = computed<TileTone>(() => (props.status === 'error' ? 'warning' : failed.value ? 'neutral' : props.tone))
</script>

<template>
  <component
    :is="to ? resolveComponent('NuxtLink') : 'div'"
    :to="to"
    class="group flex min-h-28 min-w-0 flex-col rounded-2xl border border-default bg-default p-4 shadow-sm transition"
    :class="to ? 'focus-ring hover:border-primary/40 hover:bg-primary/5' : ''"
  >
    <div class="flex items-start gap-2 text-sm leading-5 text-muted">
      <UIcon
        :name="icon"
        class="mt-0.5 size-4 shrink-0 text-primary"
      />
      <span class="min-w-0">{{ label }}</span>
      <UIcon
        v-if="to"
        name="i-lucide-chevron-right"
        class="ml-auto mt-0.5 size-4 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </div>

    <USkeleton
      v-if="status === 'loading'"
      class="mt-3 h-8 w-20"
    />
    <p
      v-else
      class="mt-2 truncate text-2xl font-semibold tracking-tight text-highlighted transition-opacity sm:text-[1.75rem]"
      :class="refreshing ? 'opacity-50' : ''"
    >
      {{ shownValue }}
    </p>

    <USkeleton
      v-if="status === 'loading'"
      class="mt-2 h-4 w-28"
    />
    <p
      v-else-if="shownDetail"
      class="mt-1 flex items-start gap-1 text-xs leading-5 sm:text-sm"
      :class="toneClass[shownTone]"
    >
      <UIcon
        v-if="toneIcon[shownTone]"
        :name="toneIcon[shownTone]"
        class="mt-0.5 size-4 shrink-0"
      />
      <span class="min-w-0">{{ shownDetail }}</span>
    </p>
  </component>
</template>
