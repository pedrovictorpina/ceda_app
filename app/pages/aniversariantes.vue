<script setup lang="ts">
import {
  BIRTHDAY_PERIODS,
  birthdayEmptyMessages,
  birthdayPeriodLabels,
  birthdayPeriodRange,
  formatBirthdayPeriodRange,
  isBirthdayPeriod,
  type BirthdayPeriod
} from '~/utils/birthdays'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Aniversariantes' })

const auth = useAuthStore()
const { people, avatarUrls, loading, error, today, load } = useBirthdays()
const period = ref<BirthdayPeriod>('today')
const exportOpen = ref(false)
const selfOptIn = ref<boolean | null>(null)

const periodItems = BIRTHDAY_PERIODS.map(value => ({ label: birthdayPeriodLabels[value], value }))
const rangeLabel = computed(() => formatBirthdayPeriodRange(period.value, birthdayPeriodRange(period.value, today.value)))
const countLabel = computed(() => `${people.value.length} ${people.value.length === 1 ? 'pessoa' : 'pessoas'}`)
const emptyState = computed(() => birthdayEmptyMessages[period.value])
const isMyBirthday = computed(() => people.value.some(person => person.id === auth.profile?.id && person.celebrationDate === today.value))

function selectPeriod(value: unknown) {
  if (isBirthdayPeriod(value)) period.value = value
}

async function loadSelfPreference() {
  const { $supabase } = useNuxtApp()
  if (!$supabase || !auth.profile) return
  const { data, error: preferenceError } = await $supabase
    .from('profiles')
    .select('birthday_greetings_opt_in')
    .eq('id', auth.profile.id)
    .maybeSingle()
  selfOptIn.value = preferenceError ? null : data?.birthday_greetings_opt_in === true
}

watch(period, value => load(value))
onMounted(() => {
  void load(period.value)
  void loadSelfPreference()
})
</script>

<template>
  <div>
    <PageIntro
      title="Aniversariantes"
      description="Celebre a vida dos irmãos. Só aparece quem escolheu receber felicitações, sem o ano de nascimento."
      icon="i-lucide-cake"
    />

    <BirthdayCelebration
      v-if="isMyBirthday && auth.profile"
      :name="auth.profile.name"
    />

    <div class="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <UTabs
        :model-value="period"
        :items="periodItems"
        :content="false"
        color="primary"
        class="w-full sm:w-auto"
        :ui="{ list: 'rounded-2xl', trigger: 'min-h-11 flex-1 sm:min-w-24 rounded-xl' }"
        aria-label="Período dos aniversariantes"
        @update:model-value="selectPeriod"
      />
      <UButton
        size="lg"
        icon="i-lucide-image-down"
        label="Gerar imagem"
        class="min-h-11 justify-center rounded-xl"
        :disabled="loading || !people.length"
        @click="exportOpen = true"
      />
    </div>

    <p class="mb-3 text-sm text-muted">
      <span class="font-medium text-default">{{ rangeLabel }}</span>
      <template v-if="!loading && !error">
        · {{ countLabel }}
      </template>
    </p>

    <UAlert
      v-if="error"
      class="mb-5"
      color="warning"
      variant="subtle"
      icon="i-lucide-wifi-off"
      :description="error"
      :actions="[{ label: 'Tentar novamente', color: 'warning', variant: 'soft', onClick: () => load(period) }]"
    />

    <ul
      v-if="loading && !people.length"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      aria-label="Carregando aniversariantes"
    >
      <li
        v-for="index in 3"
        :key="index"
      >
        <USkeleton class="h-18 rounded-2xl" />
      </li>
    </ul>

    <ul
      v-else-if="people.length"
      class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      :class="{ 'opacity-60': loading }"
      :aria-busy="loading"
    >
      <BirthdayPersonItem
        v-for="person in people"
        :key="person.id"
        :person="person"
        :avatar-url="avatarUrls[person.id]"
        :today="today"
        :is-self="person.id === auth.profile?.id"
      />
    </ul>

    <div
      v-else-if="!error"
      class="flex flex-col items-center rounded-2xl border border-dashed border-default px-4 py-10 text-center"
    >
      <div class="grid size-12 place-items-center rounded-full bg-primary/10">
        <UIcon
          name="i-lucide-cake"
          class="size-6 text-primary"
        />
      </div>
      <p class="mt-4 font-semibold">
        {{ emptyState.title }}
      </p>
      <p class="mt-1 max-w-sm text-sm text-muted">
        {{ emptyState.description }}
      </p>
    </div>

    <div
      v-if="selfOptIn === false"
      class="mt-6 flex flex-col gap-3 rounded-2xl border border-default bg-elevated/40 p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="font-semibold">
          Quer receber felicitações?
        </p>
        <p class="mt-1 text-sm text-muted">
          Informe sua data de nascimento e ative a opção no perfil. Só o dia e o mês aparecem.
        </p>
      </div>
      <UButton
        to="/perfil"
        color="neutral"
        variant="outline"
        icon="i-lucide-user-round-cog"
        label="Ir para o perfil"
        class="min-h-11 shrink-0 justify-center"
      />
    </div>

    <BirthdayImageExport
      v-model:open="exportOpen"
      :period="period"
      :today="today"
      :people="people"
      :avatar-urls="avatarUrls"
    />
  </div>
</template>
