<script setup lang="ts">
definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Fale Conosco' })
const { address, instagram, youtube, website, phone, email, phoneLink, emailLink, whatsapp, map } = useOfficialLinks()
const reception = computed(() => {
  if (whatsapp.value) return { to: whatsapp.value, label: 'Falar com a recepção no WhatsApp', icon: 'i-lucide-message-circle' }
  if (phoneLink.value) return { to: phoneLink.value, label: 'Ligar para a recepção', icon: 'i-lucide-phone' }
  if (emailLink.value) return { to: emailLink.value, label: 'Enviar e-mail à recepção', icon: 'i-lucide-mail' }
  if (instagram.value) return { to: instagram.value, label: 'Abrir Instagram oficial', icon: 'i-lucide-instagram' }
  if (website.value) return { to: website.value, label: 'Abrir site oficial', icon: 'i-lucide-external-link' }
  return null
})

const channels = [
  { title: 'Sua primeira visita', text: 'Conheça os encontros e confira a localização abaixo. Você não precisa criar uma conta para visitar a CEDA.', icon: 'i-lucide-door-open', action: 'Consultar encontros', to: '/horarios-de-culto' },
  { title: 'Cuidado e oração', text: 'Compartilhe seu pedido na área de membros. Pedimos sua entrada para cuidar da privacidade e acompanhar o pedido.', icon: 'i-lucide-heart', action: 'Entrar e pedir oração', to: '/oracao' },
  { title: 'Grupos e comunidade', text: 'Na área de membros, conheça os grupos e as possibilidades de participar e servir junto com a CEDA.', icon: 'i-lucide-users-round', action: 'Entrar e conhecer grupos', to: '/comunidade' }
]
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <PageIntro
      title="Fale Conosco"
      description="Planeje sua primeira visita e encontre os canais oficiais da igreja. Não é preciso ter cadastro para falar com a recepção."
      icon="i-lucide-messages-square"
    />
    <UCard class="mb-6">
      <h2 class="text-xl font-semibold">
        Fale com a recepção
      </h2>
      <p class="mt-2 text-sm leading-6 text-muted">
        Tire dúvidas sobre a chegada, os encontros e como participar.
        <template v-if="!whatsapp && !phoneLink && !emailLink">
          O contato direto ainda não foi publicado aqui. Use o perfil oficial para consultar a igreja.
        </template>
      </p>
      <div class="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <UButton
          v-if="reception"
          :to="reception.to"
          :target="reception.to.startsWith('https:') ? '_blank' : undefined"
          rel="noopener noreferrer"
          :label="reception.label"
          :icon="reception.icon"
        />
        <UButton
          v-if="phoneLink && whatsapp"
          :to="phoneLink"
          color="neutral"
          variant="outline"
          :label="`Ligar: ${phone}`"
          icon="i-lucide-phone"
        />
        <UButton
          v-if="emailLink && (whatsapp || phoneLink)"
          :to="emailLink"
          color="neutral"
          variant="outline"
          :label="email"
          icon="i-lucide-mail"
          class="break-all"
        />
      </div>
      <dl
        v-if="phoneLink || emailLink"
        class="mt-4 grid gap-3 text-sm sm:grid-cols-2"
      >
        <div
          v-if="phoneLink"
          class="min-w-0"
        >
          <dt class="text-muted">
            Telefone da recepção
          </dt>
          <dd class="mt-1">
            <ULink
              :to="phoneLink"
              class="focus-ring rounded-sm font-medium text-primary"
            >{{ phone }}</ULink>
          </dd>
        </div>
        <div
          v-if="emailLink"
          class="min-w-0"
        >
          <dt class="text-muted">
            E-mail da recepção
          </dt>
          <dd class="mt-1 break-all">
            <ULink
              :to="emailLink"
              class="focus-ring rounded-sm font-medium text-primary"
            >{{ email }}</ULink>
          </dd>
        </div>
      </dl>
      <p
        v-if="!reception"
        class="mt-3 text-sm text-muted"
      >
        Os canais de recepção ainda não estão disponíveis nesta página. Consulte novamente antes da sua visita.
      </p>
    </UCard>
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
              {{ address || 'O endereço ainda não foi publicado nesta página. Confirme a localização com a igreja antes de sair.' }}
            </p>
          </div>
        </div>
        <template #footer>
          <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <UButton
              v-if="map"
              :to="map"
              target="_blank"
              rel="noopener noreferrer"
              label="Abrir localização no mapa"
              icon="i-lucide-map-pinned"
            />
            <UButton
              to="/horarios-de-culto"
              color="neutral"
              variant="outline"
              label="Consultar cultos"
              icon="i-lucide-clock-3"
            />
            <UButton
              v-if="!address && reception"
              :to="reception.to"
              :target="reception.to.startsWith('https:') ? '_blank' : undefined"
              rel="noopener noreferrer"
              color="neutral"
              variant="soft"
              label="Confirmar onde fica a igreja"
              icon="i-lucide-message-circle"
            />
          </div>
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
            v-if="instagram"
            :to="instagram"
            target="_blank"
            rel="noopener noreferrer"
            color="neutral"
            variant="soft"
            label="Instagram"
            icon="i-lucide-instagram"
          />
          <UButton
            v-if="youtube"
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
