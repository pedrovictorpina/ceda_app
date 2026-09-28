<script setup lang="ts">
import type { CellLeaderProfile } from '~/types/cells'
import { formatBrazilianPhone, instagramUrl, visitGreeting, whatsappUrl } from '~/utils/cellContact'

const props = withDefaults(defineProps<{
  leaders: CellLeaderProfile[]
  cellName: string
  requesterName?: string
  /** Ids dos líderes que quem consulta pode editar (o próprio perfil ou todos, para a administração). */
  editableIds?: string[]
}>(), { requesterName: '', editableIds: () => [] })

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ edit: [leader: CellLeaderProfile] }>()
const { avatarUrl } = useAvatarUrls()

const greeting = computed(() => visitGreeting(props.requesterName, props.cellName))
</script>

<template>
  <UModal
    v-model:open="open"
    :title="leaders.length > 1 ? 'Conheça os líderes' : 'Conheça a liderança'"
    :description="cellName"
  >
    <template #body>
      <ul class="space-y-4">
        <li
          v-for="leader in leaders"
          :key="leader.userId"
          class="rounded-2xl border border-default p-4"
        >
          <div class="flex items-start gap-3">
            <UAvatar
              :src="avatarUrl(leader.avatarPath)"
              :alt="leader.name"
              size="xl"
            />
            <div class="min-w-0 flex-1">
              <p class="font-semibold">
                {{ leader.name }}
              </p>
              <p
                v-if="leader.whatsapp"
                class="text-xs text-muted"
              >
                WhatsApp {{ formatBrazilianPhone(leader.whatsapp) }}
              </p>
              <p
                class="mt-2 whitespace-pre-line text-sm"
                :class="leader.bio ? '' : 'text-muted'"
              >
                {{ leader.bio || 'Este líder ainda não escreveu um resumo.' }}
              </p>
            </div>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            <UButton
              v-if="leader.whatsapp"
              :to="whatsappUrl(leader.whatsapp, greeting)"
              target="_blank"
              rel="noopener noreferrer"
              color="success"
              variant="soft"
              icon="i-lucide-message-circle"
              label="WhatsApp"
              class="min-h-11"
            />
            <UButton
              v-if="leader.instagram"
              :to="instagramUrl(leader.instagram)"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="soft"
              icon="i-lucide-instagram"
              :label="`@${leader.instagram}`"
              class="min-h-11"
            />
            <UButton
              v-if="editableIds.includes(leader.userId)"
              color="neutral"
              variant="ghost"
              icon="i-lucide-pencil"
              label="Editar perfil"
              class="min-h-11"
              @click="emit('edit', leader)"
            />
          </div>
          <p
            v-if="!leader.whatsapp && !leader.instagram"
            class="mt-2 text-xs text-muted"
          >
            Contatos ainda não informados. Use "Quero visitar essa célula" para avisar a liderança pelo app.
          </p>
        </li>
      </ul>
    </template>
  </UModal>
</template>
