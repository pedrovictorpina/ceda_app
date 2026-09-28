<script setup lang="ts">
import type { ManagedClass } from '~/composables/useChildrenClasses'
import { formatAgeRange } from '~/utils/childAge'

defineProps<{ item: ManagedClass, teaches: boolean, busy: boolean }>()
const emit = defineEmits<{ edit: [], manage: [], join: [], leave: [], archive: [], restore: [] }>()
</script>

<template>
  <article
    class="flex flex-col rounded-2xl border bg-default p-4"
    :class="item.archived_at ? 'border-dashed border-default opacity-75' : 'border-default'"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="truncate text-lg font-bold text-highlighted">
          {{ item.name }}
        </h3>
        <p class="font-medium text-primary">
          {{ formatAgeRange(item.min_age, item.max_age) }}
        </p>
        <p
          v-if="item.room"
          class="text-sm text-muted"
        >
          {{ item.room }}
        </p>
      </div>
      <UBadge
        v-if="item.archived_at"
        color="neutral"
        variant="subtle"
        class="shrink-0 rounded-full"
        label="Arquivada"
      />
      <UBadge
        v-else-if="teaches"
        color="success"
        variant="subtle"
        class="shrink-0 rounded-full"
        icon="i-lucide-badge-check"
        label="Minha turma"
      />
    </div>
    <p
      v-if="item.notes"
      class="mt-2 line-clamp-2 text-sm text-muted"
    >
      {{ item.notes }}
    </p>
    <p class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
      <span class="inline-flex items-center gap-1">
        <UIcon
          name="i-lucide-baby"
          class="size-4"
        />{{ item.children.length === 1 ? '1 criança' : `${item.children.length} crianças` }}
      </span>
      <span class="inline-flex items-center gap-1">
        <UIcon
          name="i-lucide-users-round"
          class="size-4"
        />{{ item.teacherIds.length === 1 ? '1 professor(a)' : `${item.teacherIds.length} professores` }}
      </span>
    </p>

    <div class="mt-4 flex flex-wrap gap-2">
      <template v-if="!item.archived_at">
        <UButton
          icon="i-lucide-user-plus"
          label="Crianças"
          class="min-h-11 rounded-full"
          :disabled="busy"
          @click="emit('manage')"
        />
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-pencil"
          label="Editar"
          class="min-h-11 rounded-full"
          :disabled="busy"
          @click="emit('edit')"
        />
        <UButton
          v-if="teaches"
          color="neutral"
          variant="ghost"
          icon="i-lucide-log-out"
          label="Sair da turma"
          class="min-h-11 rounded-full"
          :loading="busy"
          @click="emit('leave')"
        />
        <UButton
          v-else
          color="neutral"
          variant="soft"
          icon="i-lucide-hand"
          label="Participar"
          class="min-h-11 rounded-full"
          :loading="busy"
          @click="emit('join')"
        />
        <UButton
          color="neutral"
          variant="ghost"
          icon="i-lucide-archive"
          label="Arquivar"
          class="min-h-11 rounded-full"
          :disabled="busy"
          @click="emit('archive')"
        />
      </template>
      <UButton
        v-else
        color="neutral"
        variant="outline"
        icon="i-lucide-archive-restore"
        label="Reativar"
        class="min-h-11 rounded-full"
        :loading="busy"
        @click="emit('restore')"
      />
    </div>
  </article>
</template>
