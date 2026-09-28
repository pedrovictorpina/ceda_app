<script setup lang="ts">
import type { ChildAlert } from '~/types/children'
import type { ManagedClass, RosterEntry } from '~/composables/useChildrenClasses'
import type { AlertSummary } from '~/utils/childCheckin'
import { formatAgeRange, formatChildAge } from '~/utils/childAge'
import { alertReasonLabel, formatClockTime } from '~/utils/childCheckin'

const props = defineProps<{
  item: ManagedClass
  entries: RosterEntry[]
  photoUrl: (path: string | null) => string
  alertFor: (checkinId: string) => AlertSummary<ChildAlert> | undefined
  busyId: string
}>()
const emit = defineEmits<{ alert: [entry: RosterEntry], checkOut: [entry: RosterEntry] }>()

function alertLine(entry: RosterEntry) {
  const summary = props.alertFor(entry.id)
  if (!summary) return null
  const sent = `${alertReasonLabel(summary.alert.reason)} às ${formatClockTime(summary.alert.created_at)}`
  return summary.acknowledgedAt
    ? { acknowledged: true, text: `${sent} · responsável a caminho desde ${formatClockTime(summary.acknowledgedAt)}` }
    : { acknowledged: false, text: `${sent} · aguardando o responsável` }
}
</script>

<template>
  <section class="rounded-2xl border border-default bg-default">
    <header class="flex items-center justify-between gap-3 border-b border-default px-4 py-3">
      <div class="min-w-0">
        <h3 class="truncate font-bold text-highlighted">
          {{ item.name }}
        </h3>
        <p class="text-sm text-muted">
          {{ formatAgeRange(item.min_age, item.max_age) }}<template v-if="item.room">
            · {{ item.room }}
          </template>
        </p>
      </div>
      <UBadge
        :color="entries.length ? 'success' : 'neutral'"
        variant="subtle"
        class="shrink-0 rounded-full"
        :label="entries.length === 1 ? '1 na salinha' : `${entries.length} na salinha`"
      />
    </header>
    <ul
      v-if="entries.length"
      class="divide-y divide-default"
    >
      <li
        v-for="entry in entries"
        :key="entry.id"
        class="flex flex-col gap-3 p-3 sm:flex-row sm:items-center"
      >
        <div class="flex min-w-0 flex-1 items-center gap-3">
          <SementinhasChildAvatar
            :name="entry.child.full_name"
            :url="photoUrl(entry.child.photo_path)"
          />
          <div class="min-w-0">
            <p class="truncate font-semibold text-highlighted">
              {{ entry.child.full_name }}
            </p>
            <p class="text-sm text-muted">
              {{ formatChildAge(entry.child.birth_date) }} · desde {{ formatClockTime(entry.checked_in_at) }}
            </p>
            <p
              v-if="entry.child.allergies"
              class="mt-0.5 flex items-start gap-1 text-sm font-medium text-warning"
            >
              <UIcon
                name="i-lucide-triangle-alert"
                class="mt-0.5 size-4 shrink-0"
              />
              {{ entry.child.allergies }}
            </p>
            <p
              v-if="alertLine(entry)"
              class="mt-0.5 text-xs font-medium"
              :class="alertLine(entry)?.acknowledged ? 'text-success' : 'text-primary'"
            >
              {{ alertLine(entry)?.text }}
            </p>
          </div>
        </div>
        <div class="flex shrink-0 gap-2">
          <UButton
            icon="i-lucide-bell-ring"
            label="Chamar responsável"
            class="min-h-11 flex-1 justify-center rounded-full sm:flex-none"
            :disabled="Boolean(busyId)"
            @click="emit('alert', entry)"
          />
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-log-out"
            class="min-h-11 rounded-full"
            :aria-label="`Registrar saída de ${entry.child.full_name}`"
            title="Registrar saída"
            :loading="busyId === entry.id"
            :disabled="Boolean(busyId)"
            @click="emit('checkOut', entry)"
          />
        </div>
      </li>
    </ul>
    <p
      v-else
      class="px-4 py-6 text-center text-sm text-muted"
    >
      Nenhuma criança na salinha agora.
    </p>
  </section>
</template>
