<script setup lang="ts">
import type { ChildAlert } from '~/types/children'
import { alertReasonIcon, formatClockTime } from '~/utils/childCheckin'

defineProps<{
  alerts: ChildAlert[]
  childName: (childId: string) => string
  className: (classId: string | null) => string
  acknowledgingId: string
}>()
const emit = defineEmits<{ acknowledge: [alertId: string] }>()
</script>

<template>
  <section
    v-if="alerts.length"
    class="mb-6 space-y-3"
    aria-label="Chamados da salinha"
    aria-live="assertive"
  >
    <article
      v-for="alert in alerts"
      :key="alert.id"
      role="alert"
      class="alert-pop flex flex-col gap-3 rounded-2xl bg-primary p-4 text-white shadow-xl shadow-primary/30 sm:flex-row sm:items-center"
    >
      <div class="flex min-w-0 flex-1 items-start gap-3">
        <span class="relative grid size-12 shrink-0 place-items-center rounded-full bg-white/20">
          <span class="alert-ping absolute inset-0 rounded-full bg-white/30" />
          <UIcon
            :name="alertReasonIcon(alert.reason)"
            class="relative size-6"
          />
        </span>
        <div class="min-w-0">
          <p class="text-sm font-medium text-white/80">
            Chamado da salinha · {{ formatClockTime(alert.created_at) }}
          </p>
          <p class="text-lg font-bold leading-snug">
            {{ childName(alert.child_id) }}: {{ alert.message }}
          </p>
          <p
            v-if="className(alert.class_id)"
            class="text-sm text-white/80"
          >
            {{ className(alert.class_id) }}
          </p>
        </div>
      </div>
      <UButton
        size="xl"
        color="neutral"
        variant="solid"
        icon="i-lucide-footprints"
        label="Estou indo"
        class="min-h-12 justify-center rounded-full bg-white text-primary hover:bg-white/90 sm:w-auto"
        block
        :loading="acknowledgingId === alert.id"
        :disabled="Boolean(acknowledgingId)"
        @click="emit('acknowledge', alert.id)"
      />
    </article>
  </section>
</template>

<style scoped>
.alert-pop {
  animation: alert-pop 0.35s ease-out;
}

.alert-ping {
  animation: alert-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}

@keyframes alert-pop {
  from { opacity: 0; transform: translateY(-0.5rem) scale(0.98); }
}

@keyframes alert-ping {
  75%, 100% { transform: scale(1.6); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .alert-pop,
  .alert-ping {
    animation: none;
  }
}
</style>
