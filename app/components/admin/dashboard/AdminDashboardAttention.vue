<script setup lang="ts">
import { listPreview } from '~/utils/adminDashboard'
import type { AttentionItem, AttentionTone } from '~/utils/adminDashboardAttention'

const props = defineProps<{
  items: AttentionItem[]
  loading: boolean
  /** Fontes que falharam ao carregar (a lista pode estar incompleta). */
  failures: number
  /** Áreas que dependem de migrações ainda não aplicadas. */
  unavailable: string[]
}>()

const toneClasses: Record<AttentionTone, string> = {
  warning: 'bg-warning/10 text-amber-600 dark:text-amber-400',
  primary: 'bg-primary/10 text-primary',
  neutral: 'bg-elevated text-muted'
}

const urgentItems = computed(() => props.items.filter(item => item.tone === 'warning').length)
</script>

<template>
  <section
    id="atencao"
    class="scroll-mt-24 rounded-2xl border border-default bg-default shadow-sm"
    aria-labelledby="dashboard-attention-title"
  >
    <header class="flex items-center gap-3 border-b border-default px-4 py-3.5 sm:px-5">
      <div class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-white">
        <UIcon
          name="i-lucide-bell-ring"
          class="size-5"
        />
      </div>
      <div class="min-w-0 flex-1">
        <h2
          id="dashboard-attention-title"
          class="font-semibold text-highlighted"
        >
          Precisa de atenção
        </h2>
        <p class="text-sm text-muted">
          <template v-if="loading && !items.length">
            Verificando pendências…
          </template>
          <template v-else-if="urgentItems">
            {{ urgentItems === 1 ? '1 item pede decisão' : `${urgentItems} itens pedem decisão` }}
          </template>
          <template v-else-if="items.length">
            Nada urgente. Veja a programação de hoje.
          </template>
          <template v-else>
            Tudo em dia por aqui.
          </template>
        </p>
      </div>
      <UBadge
        v-if="items.length"
        :color="urgentItems ? 'warning' : 'neutral'"
        variant="subtle"
        size="lg"
        :label="String(items.length)"
        :aria-label="`${items.length} itens na lista`"
      />
    </header>

    <div
      v-if="loading && !items.length"
      class="space-y-2 p-3"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-16 w-full rounded-xl"
      />
    </div>

    <ul
      v-else-if="items.length"
      class="divide-y divide-default"
    >
      <li
        v-for="item in items"
        :key="item.id"
      >
        <NuxtLink
          :to="item.to"
          class="focus-ring group flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-primary/5 sm:px-5"
        >
          <span
            class="grid size-10 shrink-0 place-items-center rounded-xl"
            :class="toneClasses[item.tone]"
          >
            <UIcon
              :name="item.icon"
              class="size-5"
            />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-highlighted">{{ item.title }}</span>
            <span class="mt-0.5 block text-sm leading-5 text-muted">{{ item.detail }}</span>
          </span>
          <UIcon
            name="i-lucide-chevron-right"
            class="size-5 shrink-0 text-dimmed transition group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </NuxtLink>
      </li>
    </ul>

    <div
      v-else
      class="flex items-center gap-3 px-4 py-6 sm:px-5"
    >
      <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
        <UIcon
          name="i-lucide-check-check"
          class="size-5"
        />
      </span>
      <p class="text-sm text-muted">
        Sem solicitações, pedidos ou estoque baixo esperando por você.
      </p>
    </div>

    <footer
      v-if="failures || unavailable.length"
      class="space-y-1 border-t border-default px-4 py-3 text-xs leading-5 text-muted sm:px-5"
    >
      <p
        v-if="failures"
        class="flex items-start gap-1.5 text-amber-700 dark:text-amber-400"
      >
        <UIcon
          name="i-lucide-circle-alert"
          class="mt-0.5 size-3.5 shrink-0"
        />
        Parte das pendências não carregou. Toque em Atualizar para tentar de novo.
      </p>
      <p
        v-if="unavailable.length"
        class="flex items-start gap-1.5"
      >
        <UIcon
          name="i-lucide-database-zap"
          class="mt-0.5 size-3.5 shrink-0"
        />
        {{ listPreview(unavailable, unavailable.length) }}: disponível após a atualização do banco.
      </p>
    </footer>
  </section>
</template>
