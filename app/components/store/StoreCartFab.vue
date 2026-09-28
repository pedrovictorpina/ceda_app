<script setup lang="ts">
import { formatBRL } from '~/utils/storeCart'

defineProps<{ count: number, total: number, open: boolean }>()
const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <Transition name="store-fab">
    <div
      v-if="count"
      class="hide-while-typing store-fab-position pointer-events-none fixed inset-x-0 z-30 flex justify-center px-4 md:justify-end md:px-8 xl:hidden"
    >
      <button
        type="button"
        class="focus-ring pointer-events-auto flex w-full max-w-md items-center gap-3 md:max-w-sm rounded-full bg-primary py-2 pl-2 pr-5 text-left text-white shadow-xl shadow-primary/30 ring-1 ring-white/10 transition active:scale-[0.98]"
        aria-haspopup="dialog"
        :aria-expanded="open"
        @click="emit('open')"
      >
        <span class="relative grid size-11 shrink-0 place-items-center rounded-full bg-white/15">
          <UIcon
            name="i-lucide-shopping-bag"
            class="size-5"
          />
          <span
            :key="count"
            class="store-fab-count absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-white px-1 text-[0.7rem] font-bold leading-5 text-primary"
          >{{ count }}</span>
        </span>
        <span class="flex-1 font-semibold">Ver pedido</span>
        <span class="text-lg font-bold tabular-nums">{{ formatBRL(total) }}</span>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/* Acima da barra de navegação móvel; sem ela (tablet), próximo à borda. */
.store-fab-position {
  bottom: calc(4.75rem + env(safe-area-inset-bottom));
}

@media (min-width: 768px) {
  .store-fab-position {
    bottom: 1.5rem;
  }
}

.store-fab-enter-active {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease-out;
}

.store-fab-leave-active {
  transition: transform 0.2s ease-in, opacity 0.2s ease-in;
}

.store-fab-enter-from,
.store-fab-leave-to {
  opacity: 0;
  transform: translateY(1.5rem) scale(0.9);
}

.store-fab-count {
  animation: store-fab-bump 0.3s ease-out;
}

@keyframes store-fab-bump {
  40% { transform: scale(1.35); }
}

@media (prefers-reduced-motion: reduce) {
  .store-fab-enter-active,
  .store-fab-leave-active {
    transition: opacity 0.15s linear;
  }

  .store-fab-enter-from,
  .store-fab-leave-to {
    transform: none;
  }

  .store-fab-count {
    animation: none;
  }
}
</style>
