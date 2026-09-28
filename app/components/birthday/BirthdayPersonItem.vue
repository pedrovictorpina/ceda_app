<script setup lang="ts">
import { formatDayMonth, initialsOf, relativeDayLabel, daysFromToday, type BirthdayPerson } from '~/utils/birthdays'

const props = defineProps<{ person: BirthdayPerson, avatarUrl?: string, today: string, isSelf: boolean }>()

const isToday = computed(() => props.person.celebrationDate === props.today)
const hasPassed = computed(() => (daysFromToday(props.person.celebrationDate, props.today) ?? 0) < 0)
const relative = computed(() => relativeDayLabel(props.person.celebrationDate, props.today))
</script>

<template>
  <li
    class="relative flex min-h-18 items-center gap-3 rounded-2xl border p-3 transition-colors"
    :class="isToday ? 'border-primary/40 bg-primary/[0.06] shadow-sm shadow-primary/10' : 'border-default bg-default'"
  >
    <div class="relative shrink-0">
      <UAvatar
        :src="avatarUrl"
        :alt="person.fullName"
        :text="initialsOf(person.fullName)"
        size="xl"
        class="size-12 ring-2"
        :class="isToday ? 'ring-primary' : 'ring-default'"
        :ui="{ fallback: 'font-semibold text-primary' }"
      />
      <span
        v-if="isToday"
        class="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-primary text-white ring-2 ring-(--ui-bg)"
        aria-hidden="true"
      >
        <UIcon
          name="i-lucide-cake"
          class="size-3.5"
        />
      </span>
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold text-highlighted">
        {{ person.fullName }}
        <span
          v-if="isSelf"
          class="font-normal text-muted"
        >(você)</span>
      </p>
      <p
        class="text-sm"
        :class="hasPassed ? 'text-dimmed' : 'text-muted'"
      >
        {{ formatDayMonth(person.day, person.month) }}
      </p>
    </div>
    <UBadge
      v-if="relative"
      class="shrink-0 rounded-full"
      :color="isToday ? 'primary' : 'neutral'"
      :variant="isToday ? 'solid' : 'subtle'"
      :label="relative"
    />
  </li>
</template>
