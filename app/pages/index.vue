<script setup lang="ts">
definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Bem-vindo', description: 'Uma base digital para viver comunidade, agenda e cuidado.' })

const highlights = [
  { title: 'Palavra para o dia', text: 'Conteúdo pastoral para ler com calma e compartilhar.', icon: 'i-lucide-book-open-text' },
  { title: 'Agenda em um só lugar', text: 'Cultos, encontros e atividades sempre ao alcance.', icon: 'i-lucide-calendar-days' },
  { title: 'Gente cuidando de gente', text: 'Grupos, oração e oportunidades para servir.', icon: 'i-lucide-heart-handshake' }
]
</script>

<template>
  <div>
    <section class="relative overflow-hidden border-b border-default">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,color-mix(in_srgb,var(--ui-primary)_18%,transparent),transparent_45%)]" />
      <div class="relative mx-auto grid min-h-[calc(82vh-4rem)] max-w-6xl items-center gap-12 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div class="max-w-2xl">
          <UBadge
            color="primary"
            variant="subtle"
            label="Bem-vindo à CEDA"
          />
          <h1 class="mt-5 text-4xl font-black tracking-tight sm:text-6xl">
            Comunidade que caminha junta.
          </h1>
          <p class="mt-5 max-w-xl text-lg text-muted">
            Mensagens, grupos, eventos e cuidado em um ambiente simples para membros e equipes.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UButton
              to="/entrar"
              size="xl"
              label="Acessar área de membros"
              trailing-icon="i-lucide-arrow-right"
            /><UButton
              to="/horarios-de-culto"
              size="xl"
              color="neutral"
              variant="outline"
              label="Planejar uma visita"
            />
          </div>
        </div>
        <div class="relative">
          <div class="absolute -inset-4 rounded-[2rem] bg-primary/10 blur-2xl" />
          <UCard class="relative border-primary/20 bg-default/90 shadow-2xl shadow-primary/10">
            <div class="p-2 sm:p-4">
              <div class="flex items-center justify-between">
                <UBadge label="Próximo encontro" />
                <span class="text-sm font-medium text-muted">Domingo</span>
              </div>
              <UIcon
                name="i-lucide-church"
                class="mt-8 size-10 text-primary"
              />
              <h2 class="mt-4 text-3xl font-bold">
                Culto de celebração
              </h2>
              <p class="mt-3 text-lg text-muted">
                19h · Templo principal
              </p>
              <div class="mt-8 grid grid-cols-2 gap-3">
                <div class="rounded-xl bg-elevated p-4">
                  <p class="text-xs uppercase tracking-wide text-muted">
                    Para quem
                  </p><p class="mt-1 font-semibold">
                    Toda a família
                  </p>
                </div>
                <div class="rounded-xl bg-elevated p-4">
                  <p class="text-xs uppercase tracking-wide text-muted">
                    Duração
                  </p><p class="mt-1 font-semibold">
                    Cerca de 1h30
                  </p>
                </div>
              </div>
            </div>
            <template #footer>
              <UButton
                to="/horarios-de-culto"
                block
                variant="soft"
                label="Ver todos os horários"
                trailing-icon="i-lucide-arrow-right"
              />
            </template>
          </UCard>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16">
      <div class="max-w-2xl">
        <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Tudo conectado
        </p>
        <h2 class="mt-2 text-3xl font-bold">
          Sua semana com a comunidade
        </h2>
        <p class="mt-3 text-muted">
          Encontre o que precisa sem depender de mensagens espalhadas ou informações antigas.
        </p>
      </div>
      <div class="mt-8 grid gap-4 sm:grid-cols-3">
        <UCard
          v-for="highlight in highlights"
          :key="highlight.title"
        >
          <UIcon
            :name="highlight.icon"
            class="size-8 text-primary"
          />
          <h3 class="mt-4 text-lg font-semibold">
            {{ highlight.title }}
          </h3>
          <p class="mt-2 text-sm leading-6 text-muted">
            {{ highlight.text }}
          </p>
        </UCard>
      </div>
      <div class="mt-12 flex flex-col justify-between gap-5 rounded-2xl bg-primary p-6 text-white sm:flex-row sm:items-center sm:p-8">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.16em] text-white/75">
            Primeira vez por aqui?
          </p><h2 class="mt-2 text-2xl font-bold">
            Queremos receber você bem.
          </h2><p class="mt-2 text-white/80">
            Conheça nossa história e encontre o melhor caminho para começar.
          </p>
        </div>
        <UButton
          to="/sobre"
          color="neutral"
          variant="solid"
          size="lg"
          label="Conhecer a CEDA"
          trailing-icon="i-lucide-arrow-right"
        />
      </div>
    </section>
  </div>
</template>
