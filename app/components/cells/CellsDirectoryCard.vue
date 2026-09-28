<script setup lang="ts">
import type { CellDirectoryEntry } from '~/types/cells'
import { canRequestVisit, cellShortScheduleLabel, formatDateKey, VISIT_STATUS_LABELS } from '~/utils/cellDirectory'

const props = withDefaults(defineProps<{ entry: CellDirectoryEntry, showOpenLink?: boolean }>(), { showOpenLink: true })
const emit = defineEmits<{ visit: [], leaders: [] }>()

const schedule = computed(() => cellShortScheduleLabel(props.entry.meetingWeekday, props.entry.meetingTime))
const participates = computed(() => props.entry.relationship === 'leader' || props.entry.relationship === 'member')
const openVisit = computed(() => {
  const visit = props.entry.myVisitRequest
  return visit && visit.status !== 'closed' ? visit : undefined
})
const address = computed(() => ({
  addressLine: props.entry.addressLine,
  neighborhood: props.entry.neighborhood,
  city: props.entry.city,
  region: props.entry.region,
  postalCode: props.entry.postalCode
}))
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl', body: 'space-y-3' }">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-lg font-semibold leading-tight">
          {{ entry.name }}
        </h3>
        <p class="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <UIcon
            name="i-lucide-calendar-clock"
            class="size-4"
          />{{ schedule }}
        </p>
      </div>
      <UBadge
        v-if="participates"
        color="primary"
        variant="subtle"
        class="shrink-0"
      >
        {{ entry.relationship === 'leader' ? 'Você lidera' : 'Você participa' }}
      </UBadge>
    </div>

    <p
      v-if="entry.description"
      class="text-sm text-muted"
    >
      {{ entry.description }}
    </p>

    <CellsAddressLink
      :address="address"
      hidden-note
    />

    <CellsLeadersSummary
      :leaders="entry.leaders"
      @open="emit('leaders')"
    />

    <div
      v-if="openVisit"
      class="flex items-start gap-2 rounded-2xl bg-success/10 p-3 text-sm"
    >
      <UIcon
        name="i-lucide-send"
        class="mt-0.5 size-4 shrink-0 text-success"
      />
      <div>
        <p class="font-medium">
          Pedido de visita enviado
        </p>
        <p class="text-muted">
          {{ VISIT_STATUS_LABELS[openVisit.status] }}<template v-if="openVisit.preferredDate">
            · Data sugerida {{ formatDateKey(openVisit.preferredDate) }}
          </template>
        </p>
      </div>
    </div>

    <template #footer>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="canRequestVisit(entry)"
          icon="i-lucide-hand-heart"
          label="Quero visitar essa célula"
          class="min-h-11 flex-1 justify-center rounded-full"
          @click="emit('visit')"
        />
        <UButton
          v-else-if="openVisit"
          color="neutral"
          variant="soft"
          icon="i-lucide-message-circle"
          label="Ver meu pedido"
          class="min-h-11 flex-1 justify-center rounded-full"
          @click="emit('visit')"
        />
        <UButton
          v-if="showOpenLink && (participates || entry.relationship === 'manager')"
          :to="`/celulas/${entry.id}`"
          color="neutral"
          variant="outline"
          label="Abrir célula"
          class="min-h-11 justify-center rounded-full"
        />
      </div>
    </template>
  </UCard>
</template>
