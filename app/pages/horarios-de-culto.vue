<script setup lang="ts">
import { formatAgendaDate } from '~/utils/churchAgenda'

definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Horários de Culto' })
const { events, loading, errorMessage, load } = useChurchAgenda(true)
const { address, map } = useOfficialLinks()
onMounted(() => load())
const visitTips = [
  { title: 'Chegue com tranquilidade', text: 'Se for sua primeira vez, chegar 15 minutos antes ajuda a conhecer o espaço.', icon: 'i-lucide-clock' },
  { title: 'Venha como estiver', text: 'Não há código de vestimenta. Queremos que você se sinta bem-vindo.', icon: 'i-lucide-smile' },
  { title: 'Traga a família', text: 'Nossa equipe pode orientar você sobre os espaços e atividades para cada idade.', icon: 'i-lucide-users-round' }
]
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <PageIntro
      title="Horários de Culto"
      description="Próximos cultos publicados pela CEDA. Horários de Brasília."
      icon="i-lucide-clock-3"
    />
    <p
      v-if="loading"
      class="py-12 text-center text-muted"
      role="status"
    >
      Consultando a programação…
    </p>
    <UAlert
      v-else-if="errorMessage"
      color="error"
      variant="soft"
      title="Não foi possível consultar os cultos"
      :description="errorMessage"
      :actions="[{ label: 'Tentar novamente', onClick: () => load() }]"
    />
    <div
      v-else-if="events.length"
      class="grid gap-4 sm:grid-cols-2"
    >
      <UCard
        v-for="(service, index) in events.slice(0, 12)"
        :key="service.id"
        :class="index === 0 ? 'ring-2 ring-primary/40' : ''"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <h2 class="font-semibold">
            {{ service.title }}
          </h2><UBadge
            v-if="index === 0"
            label="Próximo"
          />
        </div>
        <p class="mt-4 text-lg font-semibold text-primary">
          {{ formatAgendaDate(service.starts_at) }}
        </p>
        <p class="mt-2 text-sm text-muted">
          <UIcon name="i-lucide-map-pin" /> {{ service.location || 'Local a confirmar com a equipe' }}
        </p>
        <p
          v-if="service.description"
          class="mt-4 whitespace-pre-line text-sm leading-6 text-muted"
        >
          {{ service.description }}
        </p>
      </UCard>
    </div>
    <UCard
      v-else
      class="py-8 text-center"
    >
      <UIcon
        name="i-lucide-calendar-clock"
        class="size-9 text-muted"
      /><h2 class="mt-3 text-xl font-semibold">
        Ainda não há próximos cultos publicados
      </h2>
      <p class="mt-2 text-muted">
        Confirme a programação com a equipe antes de sair. Os encontros publicados aparecerão aqui.
      </p>
      <UButton
        class="mt-5"
        to="/contato"
        label="Confirmar minha visita"
      />
    </UCard>
    <UCard
      v-if="address || map"
      class="mt-6"
    >
      <h2 class="font-semibold">
        Como chegar
      </h2>
      <p
        v-if="address"
        class="mt-2 text-sm text-muted"
      >
        {{ address }}
      </p>
      <p class="mt-2 text-sm text-muted">
        Confira também o local indicado no encontro que você escolheu.
      </p>
      <UButton
        v-if="map"
        class="mt-4"
        :to="map"
        target="_blank"
        rel="noopener noreferrer"
        color="neutral"
        variant="outline"
        icon="i-lucide-map-pinned"
        label="Abrir mapa da CEDA"
      />
    </UCard>
    <section class="mt-10">
      <h2 class="text-2xl font-bold">
        Sua primeira visita
      </h2>
      <p class="mt-2 text-muted">
        Algumas informações para você chegar com mais tranquilidade.
      </p>
      <div class="mt-5 grid gap-4 md:grid-cols-3">
        <div
          v-for="tip in visitTips"
          :key="tip.title"
          class="rounded-xl border border-default p-5"
        >
          <UIcon
            :name="tip.icon"
            class="size-6 text-primary"
          />
          <h3 class="mt-3 font-semibold">
            {{ tip.title }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-muted">
            {{ tip.text }}
          </p>
        </div>
      </div>
    </section>
    <div class="mt-10 flex flex-col justify-between gap-4 rounded-2xl bg-elevated p-6 sm:flex-row sm:items-center">
      <div>
        <h2 class="text-lg font-semibold">
          Ainda ficou com alguma dúvida?
        </h2><p class="mt-1 text-sm text-muted">
          Fale com a equipe antes de sua visita.
        </p>
      </div>
      <UButton
        to="/contato"
        label="Falar com a CEDA"
        trailing-icon="i-lucide-arrow-right"
      />
    </div>
  </div>
</template>
