<script setup lang="ts">
import { dailyMessage, upcomingEvents } from '~/data/contentCatalog'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Início' })

const auth = useAuthStore()
const firstName = computed(() => auth.profile?.name?.split(' ')[0] || 'bem-vindo')
</script>

<template>
  <div>
    <PageIntro
      :title="`Olá, ${firstName}`"
      description="Sua semana com a CEDA: palavra, encontros e caminhos para participar."
      icon="i-lucide-house"
    />

    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <UCard class="relative overflow-hidden border-primary/20">
        <div class="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-primary/10 blur-3xl" />
        <div class="relative">
          <div class="flex items-center justify-between gap-3">
            <UBadge label="Palavra do dia" /><span class="text-xs text-muted">{{ dailyMessage.readTime }}</span>
          </div>
          <p class="mt-7 text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            {{ dailyMessage.reference }}
          </p>
          <h2 class="mt-2 text-3xl font-black">
            {{ dailyMessage.title }}
          </h2>
          <p class="mt-4 max-w-2xl leading-7 text-muted">
            {{ dailyMessage.excerpt }}
          </p>
        </div>
        <template #footer>
          <UButton
            :to="`/mensagens/${dailyMessage.slug}`"
            variant="soft"
            label="Continuar leitura"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h2 class="font-semibold">
              Próximos encontros
            </h2><UIcon
              name="i-lucide-calendar-days"
              class="size-5 text-primary"
            />
          </div>
        </template>
        <div class="space-y-4">
          <template
            v-for="(event, index) in upcomingEvents.slice(0, 3)"
            :key="event.id"
          >
            <div class="flex gap-3">
              <div class="mt-1 size-2 shrink-0 rounded-full bg-primary" /><div>
                <p class="font-medium">
                  {{ event.title }}
                </p><p class="mt-0.5 text-sm text-muted">
                  {{ event.date }} · {{ event.time }} · {{ event.location }}
                </p>
              </div>
            </div>
            <USeparator v-if="index < 2" />
          </template>
        </div>
        <template #footer>
          <UButton
            to="/eventos"
            color="neutral"
            variant="outline"
            label="Ver agenda completa"
          />
        </template>
      </UCard>
    </div>

    <section class="mt-7 grid gap-4 sm:grid-cols-3">
      <NuxtLink
        to="/oracao"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-heart"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Compartilhar um pedido</h2><p class="mt-1 text-sm text-muted">Registre um motivo de oração com privacidade.</p>
      </NuxtLink>
      <NuxtLink
        to="/comunidade"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-users-round"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Encontrar uma comunidade</h2><p class="mt-1 text-sm text-muted">Conheça grupos e frentes de serviço.</p>
      </NuxtLink>
      <NuxtLink
        to="/noticias"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-newspaper"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Acompanhar novidades</h2><p class="mt-1 text-sm text-muted">Veja os últimos comunicados da CEDA.</p>
      </NuxtLink>
    </section>
  </div>
</template>
