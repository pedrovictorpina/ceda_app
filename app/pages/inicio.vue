<script setup lang="ts">
import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'
import { editorialPreview } from '~/utils/editorial'
import { formatAgendaDate, formatEditorialDate } from '~/utils/churchAgenda'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Início' })
const auth = useAuthStore()
const firstName = computed(() => auth.profile?.name?.split(' ')[0] || 'bem-vindo')
const editorial = usePublishedEditorial()
const agenda = useChurchAgenda()
const message = ref<PublishedEditorialItem | null>(null)
const currentMessage = computed(() => message.value ? editorialPreview(message.value) : null)
async function loadMessage() {
  message.value = await editorial.latest('word_of_day')
}
onMounted(() => {
  void loadMessage()
  void agenda.load()
})
</script>

<template>
  <div>
    <PageIntro
      :title="`Olá, ${firstName}`"
      description="Sua semana com a CEDA: palavra, encontros e caminhos para participar."
      icon="i-lucide-house"
    />
    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <UCard class="border-primary/20">
        <UBadge label="Palavra do Dia" />
        <p
          v-if="editorial.loading.value"
          class="py-10 text-muted"
          role="status"
        >
          Carregando a mensagem…
        </p>
        <UAlert
          v-else-if="editorial.errorMessage.value"
          class="mt-5"
          color="error"
          variant="soft"
          title="Mensagem indisponível"
          :description="editorial.errorMessage.value"
          :actions="[{ label: 'Tentar novamente', onClick: loadMessage }]"
        />
        <div v-else-if="currentMessage">
          <p class="mt-5 text-sm text-muted">
            {{ formatEditorialDate(currentMessage.message_date) }} · {{ currentMessage.readTime }}
          </p>
          <h2 class="mt-3 break-words text-3xl font-black">
            {{ currentMessage.title }}
          </h2>
          <p class="mt-4 line-clamp-5 whitespace-pre-line leading-7 text-muted">
            {{ currentMessage.excerpt }}
          </p>
          <UButton
            class="mt-6"
            :to="`/mensagens/${currentMessage.slug}`"
            variant="soft"
            label="Continuar leitura"
            trailing-icon="i-lucide-arrow-right"
          />
        </div>
        <div
          v-else
          class="py-8"
        >
          <h2 class="font-semibold">
            Ainda não há mensagem publicada
          </h2><p class="mt-2 text-sm text-muted">
            As próximas reflexões da equipe aparecerão aqui.
          </p>
        </div>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Próximos encontros
          </h2>
        </template>
        <p
          v-if="agenda.loading.value"
          class="py-6 text-muted"
          role="status"
        >
          Carregando a agenda…
        </p>
        <UAlert
          v-else-if="agenda.errorMessage.value"
          color="error"
          variant="soft"
          title="Agenda indisponível"
          :description="agenda.errorMessage.value"
          :actions="[{ label: 'Tentar novamente', onClick: () => agenda.load() }]"
        />
        <div
          v-else-if="agenda.events.value.length"
          class="space-y-5"
        >
          <div
            v-for="event in agenda.events.value.slice(0, 3)"
            :key="event.id"
          >
            <h3 class="font-semibold">
              {{ event.title }}
            </h3><p class="mt-1 text-sm text-muted">
              {{ formatAgendaDate(event.starts_at) }}
            </p><p class="mt-1 text-sm text-muted">
              {{ event.location || 'Local a confirmar' }}
            </p>
          </div>
        </div>
        <p
          v-else
          class="py-6 text-sm text-muted"
        >
          Ainda não há próximos encontros publicados. Consulte a equipe se precisar confirmar um horário.
        </p>
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
      <ULink
        to="/oracao"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-heart"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Compartilhar um pedido</h2><p class="mt-1 text-sm text-muted">Registre um motivo de oração com privacidade.</p>
      </ULink>
      <ULink
        to="/comunidade"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-users-round"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Encontrar uma comunidade</h2><p class="mt-1 text-sm text-muted">Conheça grupos e frentes de serviço.</p>
      </ULink>
      <ULink
        to="/noticias"
        class="focus-ring group rounded-2xl border border-default bg-default p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg"
      >
        <UIcon
          name="i-lucide-newspaper"
          class="size-7 text-primary"
        /><h2 class="mt-3 font-semibold">Acompanhar novidades</h2><p class="mt-1 text-sm text-muted">Veja os últimos comunicados da CEDA.</p>
      </ULink>
    </section>
  </div>
</template>
