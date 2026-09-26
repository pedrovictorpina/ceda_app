<script setup lang="ts">
const props = withDefaults(defineProps<{
  label?: string
  size?: 'sm' | 'md' | 'lg'
}>(), {
  label: 'Carregando…',
  size: 'md'
})

const root = ref<HTMLElement | null>(null)
const mark = ref<HTMLElement | null>(null)
const orbit = ref<HTMLElement | null>(null)
const halo = ref<HTMLElement | null>(null)
const sizes = { sm: 'size-10', md: 'size-20', lg: 'size-28' } as const
let stopAnimation: (() => void) | undefined
let disposed = false

onMounted(async () => {
  const { gsap } = await import('gsap')
  if (disposed || !root.value || !mark.value || !orbit.value || !halo.value) return

  const media = gsap.matchMedia()
  media.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.to(orbit.value, { rotation: 360, duration: 2.4, ease: 'none', repeat: -1 })
    gsap.to(mark.value, { y: -3, scale: 1.04, duration: 0.9, ease: 'sine.inOut', repeat: -1, yoyo: true })
    gsap.to(halo.value, { opacity: 0.65, scale: 1.12, duration: 1.25, ease: 'sine.inOut', repeat: -1, yoyo: true })
  })
  stopAnimation = () => media.revert()
})

onUnmounted(() => {
  disposed = true
  stopAnimation?.()
})
</script>

<template>
  <div
    ref="root"
    role="status"
    aria-live="polite"
    class="flex flex-col items-center justify-center gap-3 text-center"
  >
    <span class="sr-only">{{ props.label }}</span>
    <span
      aria-hidden="true"
      class="relative grid shrink-0 place-items-center"
      :class="sizes[props.size]"
    >
      <span
        ref="halo"
        class="absolute inset-1 rounded-full bg-primary/25 blur-xl"
      />
      <span
        ref="orbit"
        class="brand-loader-orbit absolute inset-0 rounded-full border-2 border-primary/15"
      />
      <span
        ref="mark"
        class="relative block size-[72%] rounded-full shadow-lg shadow-primary/20"
      >
        <img
          src="/brand/ceda-logo.png"
          alt=""
          width="150"
          height="150"
          class="size-full rounded-full object-cover"
        >
      </span>
    </span>
    <span
      v-if="props.size !== 'sm'"
      aria-hidden="true"
      class="text-sm font-medium text-muted"
    >
      {{ props.label }}
    </span>
  </div>
</template>

<style scoped>
.brand-loader-orbit::after {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #f97316;
  box-shadow: 0 0 12px #f97316;
  content: '';
}

@media (prefers-reduced-motion: reduce) {
  .brand-loader-orbit::after { box-shadow: none; }
}
</style>
