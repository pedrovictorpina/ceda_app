<script setup lang="ts">
const props = defineProps<{ name: string }>()
const firstName = computed(() => props.name.trim().split(/\s+/)[0] || props.name)
const pieces = Array.from({ length: 14 }, (_, index) => index)
</script>

<template>
  <section
    class="relative mb-6 overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-orange-500 to-amber-400 p-5 text-white shadow-lg shadow-primary/25 sm:p-6"
    aria-live="polite"
  >
    <span
      v-for="piece in pieces"
      :key="piece"
      class="birthday-confetti pointer-events-none absolute top-0 block rounded-sm bg-white/70"
      :style="{ left: `${(piece * 37) % 100}%`, animationDelay: `${(piece % 7) * 0.35}s`, width: `${6 + (piece % 3) * 3}px`, height: `${4 + (piece % 2) * 4}px` }"
      aria-hidden="true"
    />
    <div class="relative flex items-center gap-4">
      <div class="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30">
        <UIcon
          name="i-lucide-party-popper"
          class="size-7"
        />
      </div>
      <div class="min-w-0">
        <p class="font-display text-2xl font-semibold italic leading-tight sm:text-3xl">
          Feliz aniversário, {{ firstName }}!
        </p>
        <p class="mt-1 text-sm text-white/90">
          Hoje a igreja celebra a sua vida. Que Deus te abençoe e te guarde.
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.birthday-confetti {
  animation: birthday-fall 3.2s linear infinite;
  opacity: 0;
}

@keyframes birthday-fall {
  0% { transform: translateY(-1rem) rotate(0deg); opacity: 0; }
  15% { opacity: 1; }
  100% { transform: translateY(9rem) rotate(260deg); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .birthday-confetti {
    animation: none;
    opacity: 0.5;
    transform: translateY(1.5rem);
  }
}
</style>
