<script setup lang="ts">
import { formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Campanhas' })
interface Campaign { id: string, title: string, description: string, external_url: string | null, goal_amount: number | null, raised_amount: number, updated_at: string }
const campaigns = ref<Campaign[]>([])
const loading = ref(true)
const errorMessage = ref('')
const currency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
const progress = (campaign: Campaign) => campaign.goal_amount ? Math.min(100, Math.round(Number(campaign.raised_amount) / Number(campaign.goal_amount) * 100)) : null
function officialUrl(value: string | null) {
  try {
    const url = new URL(value || '')
    return url.protocol === 'https:' ? url.href : undefined
  } catch { return undefined }
}
async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { $supabase } = useNuxtApp()
    if (!$supabase) throw new Error('unavailable')
    const { data, error } = await $supabase.from('campaigns').select('id, title, description, external_url, goal_amount, raised_amount, updated_at').eq('published', true).order('updated_at', { ascending: false }).limit(100)
    if (error) throw error
    campaigns.value = (data || []) as Campaign[]
  } catch {
    errorMessage.value = 'Não foi possível consultar as campanhas. Confira a conexão e tente novamente.'
  } finally { loading.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageIntro
      title="Campanhas"
      description="Iniciativas e necessidades publicadas pela equipe da CEDA."
      icon="i-lucide-hand-coins"
    />
    <UAlert
      class="mb-6"
      color="neutral"
      variant="soft"
      icon="i-lucide-info"
      title="Como participar"
      description="Confirme itens, prazos e local de entrega com a equipe. Os valores, quando informados, correspondem à última atualização publicada. Este aplicativo não recebe pagamentos."
    />
    <p
      v-if="loading"
      class="py-12 text-center text-muted"
      role="status"
    >
      Carregando as campanhas…
    </p>
    <UAlert
      v-else-if="errorMessage"
      color="error"
      variant="soft"
      title="Campanhas indisponíveis"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: load }]"
    />
    <div
      v-else-if="campaigns.length"
      class="grid gap-5 lg:grid-cols-2"
    >
      <UCard
        v-for="campaign in campaigns"
        :key="campaign.id"
      >
        <UBadge
          color="neutral"
          variant="subtle"
          label="Iniciativa publicada"
        />
        <h2 class="mt-4 text-xl font-bold">
          {{ campaign.title }}
        </h2>
        <p class="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
          {{ campaign.description }}
        </p>
        <div
          v-if="campaign.goal_amount"
          class="mt-6"
        >
          <div class="mb-2 flex flex-wrap justify-between gap-2 text-sm">
            <span class="font-medium">{{ currency(campaign.raised_amount) }} informados</span><span class="text-muted">Meta: {{ currency(campaign.goal_amount) }}</span>
          </div>
          <UProgress
            :model-value="progress(campaign) ?? 0"
            :aria-label="`Progresso da campanha ${campaign.title}`"
          />
          <p class="mt-2 text-sm text-muted">
            {{ progress(campaign) }}% da meta · Atualizado em {{ formatEditorialDate(campaign.updated_at) }}
          </p>
        </div>
        <p
          v-else
          class="mt-5 text-xs text-muted"
        >
          Atualizado em {{ formatEditorialDate(campaign.updated_at) }} · Sem meta financeira publicada.
        </p>
        <template #footer>
          <div class="flex flex-wrap gap-3">
            <UButton
              v-if="officialUrl(campaign.external_url)"
              :to="officialUrl(campaign.external_url)"
              target="_blank"
              rel="noopener noreferrer"
              variant="soft"
              label="Ver orientações da campanha"
              trailing-icon="i-lucide-external-link"
            />
            <UButton
              to="/contato"
              color="neutral"
              variant="outline"
              label="Falar com a equipe"
            />
          </div>
        </template>
      </UCard>
    </div>
    <UCard
      v-else
      class="py-10 text-center"
    >
      <UIcon
        name="i-lucide-heart-handshake"
        class="size-10 text-muted"
      /><h2 class="mt-4 text-xl font-semibold">
        Ainda não há campanhas publicadas
      </h2><p class="mt-2 text-muted">
        A equipe pode orientar você sobre outras formas de ajudar.
      </p><UButton
        class="mt-5"
        to="/contato"
        label="Quero ajudar"
      />
    </UCard>
  </div>
</template>
