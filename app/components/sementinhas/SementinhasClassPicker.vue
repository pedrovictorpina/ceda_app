<script setup lang="ts">
import type { ChildClass } from '~/types/children'
import { formatAgeRange } from '~/utils/childAge'

defineProps<{ childName: string, classes: ChildClass[], busy: boolean }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [classId: string] }>()
</script>

<template>
  <UDrawer
    v-model:open="open"
    title="Em qual turma?"
    :description="`${childName} participa de mais de uma turma. Escolha a sala de hoje.`"
    :ui="{ footer: 'safe-bottom' }"
  >
    <template #body>
      <ul class="mx-auto w-full max-w-lg space-y-2">
        <li
          v-for="item in classes"
          :key="item.id"
        >
          <button
            type="button"
            class="focus-ring flex min-h-16 w-full items-center gap-3 rounded-2xl border border-default bg-default p-3 text-left transition active:scale-[0.99] disabled:opacity-60"
            :disabled="busy"
            @click="emit('pick', item.id)"
          >
            <span class="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
              <UIcon
                name="i-lucide-school"
                class="size-5"
              />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold text-highlighted">{{ item.name }}</span>
              <span class="block text-sm text-muted">
                {{ formatAgeRange(item.min_age, item.max_age) }}<template v-if="item.room"> · {{ item.room }}</template>
              </span>
            </span>
            <UIcon
              name="i-lucide-log-in"
              class="size-5 text-primary"
            />
          </button>
        </li>
      </ul>
    </template>
  </UDrawer>
</template>
