<script setup lang="ts">
import type { CellLeaderProfile } from '~/types/cells'
import { leaderNames, leadersTeaser } from '~/utils/cellDirectory'

const props = defineProps<{ leaders: CellLeaderProfile[] }>()
const emit = defineEmits<{ open: [] }>()
const { avatarUrl } = useAvatarUrls()

const names = computed(() => leaderNames(props.leaders))
const teaser = computed(() => leadersTeaser(props.leaders))
</script>

<template>
  <div
    v-if="leaders.length"
    class="rounded-2xl bg-elevated/60 p-3"
  >
    <div class="flex items-center gap-3">
      <UAvatarGroup
        :max="3"
        size="md"
      >
        <UAvatar
          v-for="leader in leaders"
          :key="leader.userId"
          :src="avatarUrl(leader.avatarPath)"
          :alt="leader.name"
        />
      </UAvatarGroup>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">
          {{ leaders.length > 1 ? 'Líderes' : 'Líder' }}
        </p>
        <p class="truncate font-medium">
          {{ names }}
        </p>
      </div>
    </div>
    <p
      v-if="teaser"
      class="mt-2 text-sm text-muted"
    >
      {{ teaser }}
    </p>
    <UButton
      class="mt-2 min-h-11 px-0"
      color="primary"
      variant="link"
      icon="i-lucide-users-round"
      label="Conhecer os líderes"
      @click="emit('open')"
    />
  </div>
</template>
