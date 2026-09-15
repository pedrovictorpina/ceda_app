<script setup lang="ts">
definePageMeta({ layout: 'institutional' })
useSeoMeta({ title: 'Sobre Nós' })
const { address } = useOfficialLinks()

const values = [
  { title: 'Comunhão', text: 'Relacionamentos sinceros, acolhimento e espaços seguros para caminhar junto.', icon: 'i-lucide-users-round' },
  { title: 'Cuidado', text: 'Atenção às pessoas em cada fase da vida, com respeito e responsabilidade.', icon: 'i-lucide-heart-handshake' },
  { title: 'Serviço', text: 'Dons e talentos colocados em movimento para abençoar a igreja e a cidade.', icon: 'i-lucide-hand-heart' }
]

const ministryAreas = ['Famílias', 'Jovens', 'Crianças', 'Louvor', 'Ação social', 'Células e grupos']

const aboutTabs = [
  { label: 'Nossa igreja', icon: 'i-lucide-landmark', slot: 'church' as const },
  { label: 'Equipe pastoral', icon: 'i-lucide-git-branch', slot: 'team' as const }
]

interface TeamMember {
  role: string
  name: string
  initials: string
  image?: string
  instagram: string
  handle: string
  bio: string
  instagramBio: string
}

const memberModalOpen = ref(false)
const selectedTeamMember = ref<TeamMember | null>(null)

const presidency: TeamMember[] = [
  {
    role: 'Pastor presidente',
    name: 'Leandro Schubert Oliveira',
    initials: 'LS',
    image: '/team/pastor-leandro.jpeg',
    instagram: 'https://www.instagram.com/leandro.schubert/',
    handle: '@leandro.schubert',
    bio: 'Líder sênior na @igrejaceda. Esposo da @pastorarobertaoficial.',
    instagramBio: 'Líder Sênior na @igrejaceda ⛪️\nEsposo da @pastorarobertaoficial'
  },
  {
    role: 'Pastora presidente',
    name: 'Roberta Oliveira',
    initials: 'RO',
    image: '/team/pastora-roberta.jpeg',
    instagram: 'https://www.instagram.com/pastorarobertaoficial/',
    handle: '@pastorarobertaoficial',
    bio: 'Pastora e líder na @igrejaceda, mãe do Gabriel, Daniel e Isabel, e terapeuta TRG.',
    instagramBio: 'Esposa do @leandro.schubert\nMãe do Gabriel, Daniel e Isabel\nPastora e líder na @igrejaceda\nTerapeuta TRG @robertaoliveira_terapeuta'
  }
]

const leadership: TeamMember[] = [
  {
    role: 'Liderança de louvor',
    name: 'Daniel Schubert',
    initials: 'DS',
    instagram: 'https://www.instagram.com/daniel_schubert7/',
    handle: '@daniel_schubert7',
    bio: 'Worship leader na @igrejaceda e professor de música no @staccatocanoas.',
    instagramBio: 'Blog pessoal\nRS · 🧉\n23 years ⚡️\n💍 - @maizep\nWorship leader - @igrejaceda 🎵❤️‍🔥\nProfessor de música - @staccatocanoas'
  },
  {
    role: 'Pastor',
    name: 'Eder de Almeida',
    initials: 'EA',
    image: '/team/pastor-eder.jpeg',
    instagram: 'https://www.instagram.com/pr_eder_almeida/',
    handle: '@pr_eder_almeida',
    bio: 'Pastor da CEDA.',
    instagramBio: ''
  },
  {
    role: 'Pastor',
    name: 'Everton Baick Dias',
    initials: 'EB',
    image: '/team/pastor-everton.jpeg',
    instagram: 'https://www.instagram.com/evertonbaickdias/',
    handle: '@evertonbaickdias',
    bio: 'Pastor da CEDA. Esposo da Pra. Jaqueline Schubert Dias.',
    instagramBio: ''
  },
  {
    role: 'Pastora',
    name: 'Jaqueline Schubert Dias',
    initials: 'JD',
    image: '/team/pastora-jaqueline.jpeg',
    instagram: 'https://www.instagram.com/jaquesdias10/',
    handle: '@jaquesdias10',
    bio: 'Pastora da CEDA. Esposa do Pr. Everton Baick Dias.',
    instagramBio: ''
  },
  {
    role: 'Contato ministerial',
    name: 'Daia Rauber',
    initials: 'DR',
    image: '/team/daia-rauber.jpeg',
    instagram: 'https://www.instagram.com/daiarauber/',
    handle: '@daiarauber',
    bio: 'Membro da equipe de liderança da CEDA. Esposa do Pr. Eder de Almeida.',
    instagramBio: ''
  },
  {
    role: 'Contato ministerial',
    name: 'Vashti Machado Undap',
    initials: 'VM',
    image: '/team/vashti-machado.jpeg',
    instagram: 'https://www.instagram.com/vashti.machado.undap/',
    handle: '@vashti.machado.undap',
    bio: 'Membro da equipe de liderança da CEDA. Esposa de Luis Fernando Machado.',
    instagramBio: ''
  },
  {
    role: 'Contato ministerial',
    name: 'Luis Fernando Machado',
    initials: 'LM',
    image: '/team/luis-machado.jpeg',
    instagram: 'https://www.instagram.com/luis.fernando.machado.84/',
    handle: '@luis.fernando.machado.84',
    bio: 'Membro da equipe de liderança da CEDA. Esposo de Vashti Machado Undap.',
    instagramBio: ''
  }
]

const ministryChannels = [
  { name: 'Somos North', description: 'Jovens', instagram: 'https://www.instagram.com/somosnorth/', handle: '@somosnorth', icon: 'i-lucide-sparkles' },
  { name: 'CEDA Vende', description: 'Canal oficial', instagram: 'https://www.instagram.com/cedavende/', handle: '@cedavende', icon: 'i-lucide-store' },
  { name: 'CEDA Kids', description: 'Ministério infantil', instagram: 'https://www.instagram.com/cedakids_/', handle: '@cedakids_', icon: 'i-lucide-baby' }
]

function openTeamMember(member: TeamMember) {
  selectedTeamMember.value = member
  memberModalOpen.value = true
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-10">
    <PageIntro
      title="Sobre Nós"
      description="Conheça nossa essência, os valores que nos movem e os caminhos para fazer parte."
      icon="i-lucide-landmark"
    />

    <UTabs :items="aboutTabs">
      <template #church>
        <div class="pt-6">
          <section class="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <UCard class="overflow-hidden">
              <div class="max-w-3xl py-2">
                <UBadge
                  variant="subtle"
                  label="Nossa essência"
                />
                <h2 class="mt-4 text-2xl font-bold sm:text-3xl">
                  Uma igreja, muitas pessoas servindo
                </h2>
                <p class="mt-4 text-lg leading-8 text-muted">
                  A CEDA é uma comunidade cristã que existe para aproximar pessoas, cultivar fé e transformar cuidado em atitudes práticas. Aqui, cada pessoa pode encontrar um lugar para pertencer, crescer e servir.
                </p>
              </div>
              <template #footer>
                <div class="flex flex-wrap gap-3">
                  <UButton
                    to="/horarios-de-culto"
                    label="Planejar uma visita"
                    trailing-icon="i-lucide-arrow-right"
                  />
                  <UButton
                    to="/contato"
                    color="neutral"
                    variant="outline"
                    label="Falar com a CEDA"
                  />
                </div>
              </template>
            </UCard>

            <UCard class="bg-elevated/60">
              <UIcon
                name="i-lucide-map-pinned"
                class="size-8 text-primary"
              />
              <h2 class="mt-4 text-lg font-semibold">
                Onde nos encontrar
              </h2>
              <p class="mt-2 text-sm leading-6 text-muted">
                {{ address || 'Consulte nossos canais oficiais para receber a localização e orientações para sua primeira visita.' }}
              </p>
              <template #footer>
                <UButton
                  to="/contato"
                  size="sm"
                  color="neutral"
                  variant="soft"
                  label="Ver canais de contato"
                />
              </template>
            </UCard>
          </section>

          <section
            class="mt-10"
            aria-labelledby="values-title"
          >
            <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
              Como caminhamos
            </p>
            <h2
              id="values-title"
              class="mt-2 text-2xl font-bold"
            >
              Valores vividos em comunidade
            </h2>
            <div class="mt-5 grid gap-4 sm:grid-cols-3">
              <UCard
                v-for="value in values"
                :key="value.title"
              >
                <UIcon
                  :name="value.icon"
                  class="size-7 text-primary"
                />
                <h3 class="mt-4 text-lg font-semibold">
                  {{ value.title }}
                </h3>
                <p class="mt-2 text-sm leading-6 text-muted">
                  {{ value.text }}
                </p>
              </UCard>
            </div>
          </section>

          <section class="mt-10 rounded-2xl border border-default bg-elevated/40 p-6 sm:p-8">
            <div class="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  Encontre seu lugar
                </p>
                <h2 class="mt-2 text-2xl font-bold">
                  Da chegada ao serviço
                </h2>
                <p class="mt-3 leading-7 text-muted">
                  Você pode começar participando de um culto, conhecer um grupo e, no seu tempo, descobrir uma área de serviço que combine com seus dons.
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <span
                  v-for="area in ministryAreas"
                  :key="area"
                  class="rounded-full border border-default bg-default px-4 py-2 text-sm font-medium"
                >
                  {{ area }}
                </span>
              </div>
            </div>
          </section>
        </div>
      </template>

      <template #team>
        <section class="pt-6">
          <div class="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
            <div class="max-w-3xl">
              <UBadge
                variant="subtle"
                label="Equipe Pastoral CEDA"
              />
              <h2 class="mt-4 text-2xl font-bold sm:text-3xl">
                Liderança que serve em comunhão
              </h2>
              <p class="mt-3 leading-7 text-muted">
                Uma estrutura em árvore para apresentar a presidência, as lideranças e os ministérios. Novas pessoas e áreas podem ser incluídas gradualmente.
              </p>
            </div>

            <div class="mt-8 text-center">
              <span class="inline-flex rounded-full border border-primary/20 bg-default px-4 py-2 text-sm font-semibold text-primary">
                Presidência
              </span>
              <div class="mx-auto h-8 w-px bg-primary/30" />
            </div>

            <div class="grid gap-4 lg:grid-cols-2">
              <UCard
                v-for="member in presidency"
                :key="member.name"
                class="cursor-pointer border-primary/20 bg-default transition hover:border-primary/50 hover:shadow-md focus-visible:outline-3 focus-visible:outline-primary"
                role="button"
                tabindex="0"
                @click="openTeamMember(member)"
                @keydown.enter="openTeamMember(member)"
                @keydown.space.prevent="openTeamMember(member)"
              >
                <div class="flex items-start gap-4">
                  <UAvatar
                    :src="member.image"
                    :alt="`Foto de ${member.name}`"
                    :fallback="member.initials"
                    size="xl"
                  />
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-primary">
                      {{ member.role }}
                    </p>
                    <h3 class="mt-1 text-lg font-semibold">
                      {{ member.name }}
                    </h3>
                    <p class="mt-2 text-sm leading-6 text-muted">
                      {{ member.bio }}
                    </p>
                    <UButton
                      class="mt-4"
                      :to="member.instagram"
                      target="_blank"
                      rel="noopener noreferrer"
                      color="neutral"
                      variant="outline"
                      size="sm"
                      icon="i-lucide-instagram"
                      :label="member.handle"
                      @click.stop
                    />
                  </div>
                </div>
              </UCard>
            </div>

            <div class="mx-auto h-10 w-px bg-primary/30" />
            <div class="mx-auto w-fit rounded-full border border-default bg-default px-4 py-2 text-sm font-semibold">
              Lideranças e contatos ministeriais
            </div>
            <div class="mx-auto h-8 w-px bg-primary/30" />

            <div class="grid gap-4 md:grid-cols-3">
              <UCard
                v-for="member in leadership"
                :key="member.name"
                class="cursor-pointer bg-default transition hover:border-primary/50 hover:shadow-md focus-visible:outline-3 focus-visible:outline-primary"
                role="button"
                tabindex="0"
                @click="openTeamMember(member)"
                @keydown.enter="openTeamMember(member)"
                @keydown.space.prevent="openTeamMember(member)"
              >
                <UAvatar
                  :src="member.image"
                  :alt="`Foto de ${member.name}`"
                  :fallback="member.initials"
                  size="lg"
                />
                <p class="mt-4 text-sm font-semibold text-primary">
                  {{ member.role }}
                </p>
                <h3 class="mt-1 font-semibold">
                  {{ member.name }}
                </h3>
                <p class="mt-2 min-h-15 text-sm leading-6 text-muted">
                  {{ member.bio }}
                </p>
                <UButton
                  class="mt-4"
                  :to="member.instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-instagram"
                  :label="member.handle"
                  @click.stop
                />
              </UCard>
            </div>
          </div>

          <section class="mt-6">
            <div class="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
              <div>
                <p class="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  Canais da igreja
                </p>
                <h2 class="mt-2 text-2xl font-bold">
                  Ministérios e comunidades
                </h2>
              </div>
              <p class="text-sm text-muted">
                Acompanhe cada frente pelos canais oficiais.
              </p>
            </div>
            <div class="mt-5 grid gap-4 md:grid-cols-3">
              <UCard
                v-for="channel in ministryChannels"
                :key="channel.name"
              >
                <UIcon
                  :name="channel.icon"
                  class="size-7 text-primary"
                />
                <h3 class="mt-4 font-semibold">
                  {{ channel.name }}
                </h3>
                <p class="mt-1 text-sm text-muted">
                  {{ channel.description }}
                </p>
                <UButton
                  class="mt-4"
                  :to="channel.instagram"
                  target="_blank"
                  rel="noopener noreferrer"
                  color="neutral"
                  variant="outline"
                  size="sm"
                  icon="i-lucide-instagram"
                  :label="channel.handle"
                />
              </UCard>
            </div>
          </section>
        </section>
      </template>
    </UTabs>

    <UModal
      v-model:open="memberModalOpen"
      :title="selectedTeamMember?.name || 'Equipe pastoral'"
      :description="selectedTeamMember?.role"
    >
      <template #body>
        <div
          v-if="selectedTeamMember"
          class="space-y-5"
        >
          <div class="flex items-center gap-4">
            <UAvatar
              :src="selectedTeamMember.image"
              :alt="`Foto de ${selectedTeamMember.name}`"
              :fallback="selectedTeamMember.initials"
              size="xl"
            />
            <div>
              <p class="font-semibold">
                {{ selectedTeamMember.name }}
              </p>
              <p class="text-sm text-primary">
                {{ selectedTeamMember.role }}
              </p>
            </div>
          </div>

          <div class="rounded-xl border border-default bg-elevated/50 p-4">
            <p class="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Descrição do Instagram
            </p>
            <p
              v-if="selectedTeamMember.instagramBio"
              class="mt-3 whitespace-pre-line text-sm leading-6"
            >
              {{ selectedTeamMember.instagramBio }}
            </p>
            <p
              v-else
              class="mt-3 text-sm leading-6 text-muted"
            >
              A descrição deste perfil será adicionada em breve.
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Fechar"
            @click="memberModalOpen = false"
          />
          <UButton
            v-if="selectedTeamMember"
            :to="selectedTeamMember.instagram"
            target="_blank"
            rel="noopener noreferrer"
            icon="i-lucide-instagram"
            :label="selectedTeamMember.handle"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
