<script setup lang="ts">
import type { ChildCheckin } from '~/types/children'
import type { FamilyChild } from '~/composables/useFamilyChildren'
import { describeNextBirthday, formatAgeRange, formatBirthday, formatChildAge } from '~/utils/childAge'
import { describeCheckinStatus } from '~/utils/childCheckin'

const props = defineProps<{
  child: FamilyChild
  photoUrl: string
  checkin?: ChildCheckin
  busy: boolean
}>()
const emit = defineEmits<{ checkIn: [], checkOut: [], edit: [] }>()

const checkedIn = computed(() => Boolean(props.checkin))
const currentClass = computed(() => props.child.classes.find(item => item.id === props.checkin?.class_id))
const status = computed(() => describeCheckinStatus(props.checkin, currentClass.value?.name))
const birthday = computed(() => describeNextBirthday(props.child.birth_date))
const isBirthdayToday = computed(() => birthday.value.endsWith('hoje!'))
</script>

<template>
  <article
    class="flex flex-col rounded-2xl border bg-default p-4 shadow-sm transition-colors"
    :class="checkedIn ? 'border-success/50 bg-success/[0.04]' : 'border-default'"
  >
    <div class="flex items-start gap-3">
      <SementinhasChildAvatar
        :name="child.full_name"
        :url="photoUrl"
        size="lg"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <h3 class="line-clamp-2 text-lg font-bold leading-snug text-highlighted">
            {{ child.full_name }}
          </h3>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-pencil"
            class="-mr-2 -mt-1 size-11 shrink-0 justify-center rounded-full"
            :aria-label="`Editar ${child.full_name}`"
            @click="emit('edit')"
          />
        </div>
        <p class="text-sm font-medium text-default">
          {{ formatChildAge(child.birth_date) }}
          <span
            v-if="child.birth_date"
            class="text-muted"
          >· aniversário em {{ formatBirthday(child.birth_date) }}</span>
        </p>
        <p
          v-if="birthday"
          class="mt-0.5 flex items-center gap-1 text-sm"
          :class="isBirthdayToday ? 'font-semibold text-primary' : 'text-muted'"
        >
          <UIcon
            name="i-lucide-cake"
            class="size-4 shrink-0"
          />
          {{ birthday }}
        </p>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap gap-1.5">
      <UBadge
        v-for="item in child.classes"
        :key="item.id"
        color="neutral"
        variant="subtle"
        class="rounded-full"
        :label="`${item.name} · ${formatAgeRange(item.min_age, item.max_age)}`"
      />
      <p
        v-if="!child.classes.length"
        class="text-sm text-muted"
      >
        Ainda sem turma. A equipe infantil adiciona a criança à turma certa.
      </p>
    </div>

    <p
      class="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold"
      :class="checkedIn ? 'bg-success/10 text-success' : 'bg-elevated text-muted'"
    >
      <UIcon
        :name="checkedIn ? 'i-lucide-door-open' : 'i-lucide-house'"
        class="size-5 shrink-0"
      />
      {{ status }}
    </p>

    <div class="mt-3">
      <UButton
        v-if="checkedIn"
        block
        size="xl"
        color="neutral"
        variant="outline"
        icon="i-lucide-log-out"
        label="Fazer check-out"
        class="min-h-12 justify-center rounded-full"
        :loading="busy"
        @click="emit('checkOut')"
      />
      <UButton
        v-else
        block
        size="xl"
        icon="i-lucide-log-in"
        label="Fazer check-in"
        class="min-h-12 justify-center rounded-full"
        :loading="busy"
        :disabled="!child.classes.length"
        @click="emit('checkIn')"
      />
    </div>
  </article>
</template>
