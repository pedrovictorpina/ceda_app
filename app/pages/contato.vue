<script setup lang="ts">
definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Fale Conosco' })
const { address } = useOfficialLinks()
const { instagram, youtube } = useOfficialLinks()

const channels = [
  { title: 'Recepção e primeira visita', text: 'Dúvidas sobre horários, localização e como participar pela primeira vez.', icon: 'i-lucide-door-open', action: 'Ver horários', to: '/horarios-de-culto' },
  { title: 'Cuidado e oração', text: 'Se você precisa conversar ou deseja compartilhar um pedido de oração, estamos aqui.', icon: 'i-lucide-heart', action: 'Pedir oração', to: '/oracao' },
  { title: 'Grupos e comunidade', text: 'Conheça os grupos, ministérios e possibilidades de servir junto com a CEDA.', icon: 'i-lucide-users-round', action: 'Conhecer grupos', to: '/comunidade' }
]
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <PageIntro
      title="Fale Conosco"
      description="Encontre o canal certo para sua primeira visita, um pedido de cuidado ou uma dúvida."
      icon="i-lucide-mail"
    />
    <div class="grid gap-4 lg:grid-cols-3">
      <UCard
        v-for="channel in channels"
        :key="channel.title"
      >
        <UIcon
          :name="channel.icon"
          class="size-7 text-primary"
        />
        <h2 class="mt-4 text-lg font-semibold">
          {{ channel.title }}
        </h2>
        <p class="mt-2 min-h-18 text-sm leading-6 text-muted">
          {{ channel.text }}
        </p>
        <template #footer>
          <UButton
            :to="channel.to"
            size="sm"
            variant="soft"
            :label="channel.action"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>
    </div>

    <section class="mt-8 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <UCard>
        <div class="flex items-start gap-4">
          <div class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <UIcon
              name="i-lucide-map-pin"
              class="size-6"
            />
          </div>
          <div>
            <h2 class="text-xl font-semibold">
              Visite a CEDA
            </h2>
            <p class="mt-2 leading-7 text-muted">
              {{ address || 'A localização oficial é compartilhada pelos canais da igreja. Antes de sair, confira também o horário do encontro que deseja visitar.' }}
            </p>
          </div>
        </div>
        <template #footer>
          <UButton
            to="/horarios-de-culto"
            color="neutral"
            variant="outline"
            label="Consultar cultos"
            icon="i-lucide-clock-3"
          />
        </template>
      </UCard>
      <UCard class="bg-elevated/60">
        <h2 class="text-xl font-semibold">
          Acompanhe nossos canais
        </h2>
        <p class="mt-2 text-sm leading-6 text-muted">
          Agenda, mensagens e novidades também são publicadas nos perfis oficiais.
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <UButton
            :to="instagram"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="soft"
            label="Instagram"
            icon="i-lucide-instagram"
          />
          <UButton
            :to="youtube"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="soft"
            label="YouTube"
            icon="i-lucide-youtube"
          />
        </div>
      </UCard>
    </section>
  </div>
</template>
