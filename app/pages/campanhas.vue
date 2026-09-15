<script setup lang="ts">
import { campaignCards } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Campanhas' })

const selectedCampaign = ref<(typeof campaignCards)[number] | null>(null)
const campaignOpen = computed({
  get: () => Boolean(selectedCampaign.value),
  set: (value: boolean) => {
    if (!value) selectedCampaign.value = null
  }
})
</script>

<template>
  <div>
    <PageIntro
      title="Campanhas"
      description="Acompanhe iniciativas de cuidado, necessidades atuais e o progresso de cada mobilização."
      icon="i-lucide-hand-coins"
    />

    <div class="mb-6 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <UIcon
        name="i-lucide-shield-check"
        class="mt-0.5 size-5 shrink-0 text-primary"
      />
      <p class="text-sm leading-6 text-muted">
        As campanhas nesta área são informativas. Contribuições e entregas são combinadas somente pelos canais oficiais da CEDA.
      </p>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <UCard
        v-for="campaign in campaignCards"
        :key="campaign.title"
        class="overflow-hidden"
      >
        <div class="flex items-start gap-4">
          <div class="grid size-13 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <UIcon
              :name="campaign.icon"
              class="size-7"
            />
          </div>
          <div>
            <UBadge
              color="neutral"
              variant="subtle"
              label="Campanha ativa"
            />
            <h2 class="mt-3 text-xl font-bold">
              {{ campaign.title }}
            </h2>
            <p class="mt-2 min-h-18 text-sm leading-6 text-muted">
              {{ campaign.description }}
            </p>
          </div>
        </div>
        <div class="mt-6">
          <div class="mb-2 flex justify-between gap-4 text-sm">
            <span class="font-medium">{{ campaign.raised }}</span>
            <span class="text-muted">{{ campaign.goal }}</span>
          </div>
          <UProgress :model-value="campaign.progress" />
          <p class="mt-2 text-right text-xs font-semibold text-primary">
            {{ campaign.progress }}% do objetivo
          </p>
        </div>
        <template #footer>
          <UButton
            variant="soft"
            :label="campaign.action"
            trailing-icon="i-lucide-arrow-right"
            @click="selectedCampaign = campaign"
          />
        </template>
      </UCard>
    </div>

    <section class="mt-10 rounded-2xl bg-elevated p-6 sm:p-8">
      <div class="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <h2 class="text-xl font-semibold">
            Quer ajudar de outra forma?
          </h2><p class="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Tempo, conhecimento e disponibilidade também fazem diferença. Conheça as frentes de serviço da comunidade.
          </p>
        </div>
        <UButton
          to="/comunidade"
          color="neutral"
          variant="outline"
          label="Encontrar uma frente"
        />
      </div>
    </section>

    <UModal
      v-model:open="campaignOpen"
      :title="selectedCampaign?.title"
      description="Orientações da campanha"
    >
      <template #body>
        <div
          v-if="selectedCampaign"
          class="space-y-4"
        >
          <p class="leading-7 text-muted">
            {{ selectedCampaign.description }}
          </p>
          <div class="rounded-xl bg-elevated p-4">
            <p class="font-medium">
              Como participar com segurança
            </p>
            <p class="mt-2 text-sm leading-6 text-muted">
              Confirme os itens prioritários, prazos e local de entrega diretamente com a equipe responsável. Este aplicativo não solicita pagamento nem dados bancários.
            </p>
          </div>
          <UButton
            to="/contato"
            label="Falar com a equipe"
            trailing-icon="i-lucide-arrow-right"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
