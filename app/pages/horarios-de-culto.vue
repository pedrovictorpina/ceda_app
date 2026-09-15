<script setup lang="ts">
definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Horários de Culto' })
const services = [
  { title: 'Culto de celebração', schedule: 'Domingos, 19h', place: 'Templo principal', audience: 'Toda a família', description: 'Louvor, mensagem e comunhão em um encontro para todas as idades.', next: true },
  { title: 'Culto de oração', schedule: 'Quartas, 20h', place: 'Templo principal', audience: 'Encontro aberto', description: 'Um tempo dedicado à oração, gratidão e cuidado uns pelos outros.', next: false }
]

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
      description="Recorrências e próximos cultos derivados do calendário central."
      icon="i-lucide-clock-3"
    /><div class="grid gap-4 sm:grid-cols-2">
      <UCard
        v-for="service in services"
        :key="service.title"
        :class="service.next ? 'ring-2 ring-primary/40' : ''"
      >
        <div class="flex items-start justify-between gap-4">
          <h2 class="font-semibold">
            {{ service.title }}
          </h2><UBadge
            v-if="service.next"
            label="Próximo"
          />
        </div><p class="mt-3 text-lg font-semibold text-primary">
          {{ service.schedule }}
        </p><p class="mt-1 flex items-center gap-2 text-sm text-muted">
          <UIcon name="i-lucide-map-pin" />{{ service.place }}
        </p>
        <p class="mt-4 text-sm leading-6 text-muted">
          {{ service.description }}
        </p>
        <template #footer>
          <div class="flex items-center gap-2 text-sm">
            <UIcon
              name="i-lucide-users"
              class="text-primary"
            /><span>{{ service.audience }}</span>
          </div>
        </template>
      </UCard>
    </div>
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
