<script setup lang="ts">
import type { CellDetail } from '~/types/domain'
import { cellShortScheduleLabel } from '~/utils/cellDirectory'

const props = defineProps<{ detail: CellDetail, canManage: boolean }>()
const emit = defineEmits<{ edit: [], leaders: [] }>()

const schedule = computed(() => cellShortScheduleLabel(props.detail.meetingWeekday, props.detail.meetingTime))
</script>

<template>
  <UCard :ui="{ root: 'rounded-2xl', body: 'space-y-3' }">
    <template #header>
      <div class="flex items-start justify-between gap-2">
        <div>
          <h2 class="font-semibold">
            Encontro
          </h2>
          <p class="mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
            <UIcon
              name="i-lucide-calendar-clock"
              class="size-4"
            />{{ schedule }}
          </p>
        </div>
        <UButton
          v-if="canManage"
          color="neutral"
          variant="soft"
          icon="i-lucide-pencil"
          label="Editar"
          class="min-h-11"
          @click="emit('edit')"
        />
      </div>
    </template>
    <CellsAddressLink :address="detail.address ?? {}" />
    <p
      v-if="canManage && detail.address"
      class="text-xs text-muted"
    >
      {{ detail.showFullAddress ? 'Endereço completo visível no diretório para todos os membros do app.' : 'No diretório aparecem só bairro e cidade; o endereço completo fica com os membros da célula.' }}
    </p>
    <CellsLeadersSummary
      :leaders="detail.leaders"
      @open="emit('leaders')"
    />
  </UCard>
</template>
