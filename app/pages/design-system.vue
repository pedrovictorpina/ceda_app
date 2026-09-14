<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Design System' })
const tabs = [{ label: 'Cores e tokens', icon: 'i-lucide-swatch-book', slot: 'colors' as const }, { label: 'Tipografia', icon: 'i-lucide-type', slot: 'type' as const }, { label: 'Componentes', icon: 'i-lucide-blocks', slot: 'components' as const }, { label: 'Estados', icon: 'i-lucide-loader-circle', slot: 'states' as const }]
const modalOpen = ref(false)
</script>

<template>
  <div>
    <PageIntro
      title="Design System"
      description="Fonte visual web para evoluir tokens, tipografia, componentes e estados do produto."
      icon="i-lucide-palette"
    /><UTabs
      :items="tabs"
      class="w-full"
    >
      <template #colors>
        <div class="grid gap-4 pt-5 sm:grid-cols-3">
          <UCard>
            <div class="h-20 rounded-lg bg-primary" /><p class="mt-3 font-medium">
              Primary · orange
            </p><p class="text-sm text-muted">
              Alterável em app.config.ts
            </p>
          </UCard><UCard>
            <div class="h-20 rounded-lg bg-white ring ring-default" /><p class="mt-3 font-medium">
              Tema claro · branco
            </p>
          </UCard><UCard>
            <div class="h-20 rounded-lg bg-zinc-950" /><p class="mt-3 font-medium">
              Tema escuro · preto
            </p>
          </UCard>
        </div>
      </template><template #type>
        <div class="space-y-5 pt-5">
          <h1 class="text-4xl font-black">
            Título principal
          </h1><h2 class="text-2xl font-bold">
            Título de seção
          </h2><p>Texto de leitura com contraste acessível e ritmo confortável.</p><p class="text-sm text-muted">
            Texto auxiliar e metadados.
          </p>
        </div>
      </template><template #components>
        <div class="space-y-6 pt-5">
          <div class="flex flex-wrap gap-3">
            <UButton label="Primário" /><UButton
              color="neutral"
              variant="outline"
              label="Secundário"
            /><UBadge label="Badge" />
          </div><div class="grid gap-4 sm:grid-cols-2">
            <UFormField label="Campo">
              <UInput placeholder="Digite aqui" />
            </UFormField><UCard>
              <p class="font-semibold">
                Card
              </p><p class="text-sm text-muted">
                Superfície de conteúdo.
              </p>
            </UCard>
          </div><UAlert
            title="Alerta informativo"
            description="Mensagem curta, clara e acionável."
          /><UButton
            label="Abrir overlay"
            color="neutral"
            @click="modalOpen = true"
          /><UModal
            v-model:open="modalOpen"
            title="Exemplo de modal"
            description="Overlay acessível fornecido pelo Nuxt UI"
          >
            <template #body>
              <p class="text-muted">
                Conteúdo do modal.
              </p>
            </template>
          </UModal>
        </div>
      </template><template #states>
        <div class="grid gap-4 pt-5 sm:grid-cols-3">
          <UCard>
            <UIcon
              name="i-lucide-inbox"
              class="size-7 text-muted"
            /><h3 class="mt-2 font-semibold">
              Vazio
            </h3><p class="text-sm text-muted">
              Explique o próximo passo.
            </p>
          </UCard><UCard>
            <USkeleton class="h-7 w-2/3" /><USkeleton class="mt-3 h-4 w-full" /><p class="mt-3 text-sm text-muted">
              Carregamento
            </p>
          </UCard><UAlert
            color="error"
            title="Algo deu errado"
            description="Tente novamente sem perder o contexto."
          />
        </div>
      </template>
    </UTabs>
  </div>
</template>
