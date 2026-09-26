<script setup lang="ts">
import { CalendarDate } from '@internationalized/date'

definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Design System' })

const tabs = [
  { label: 'Cores e tokens', icon: 'i-lucide-swatch-book', slot: 'colors' as const },
  { label: 'Tipografia', icon: 'i-lucide-type', slot: 'type' as const },
  { label: 'Formulários', icon: 'i-lucide-list-checks', slot: 'forms' as const },
  { label: 'Componentes', icon: 'i-lucide-blocks', slot: 'components' as const },
  { label: 'Feedback e modais', icon: 'i-lucide-message-circle-more', slot: 'feedback' as const }
]

const textInput = ref('')
const passwordInput = ref('')
const showPassword = ref(false)
const longText = ref('')
const selectValue = ref('culto')
const dateValue = ref('2026-09-14')
const checkboxValue = ref(true)
const toggleValue = ref(true)
const calendarDate = new CalendarDate(2026, 9, 14)
const alertModalOpen = ref(false)
const noticeModalOpen = ref(false)
const selectItems = [
  { label: 'Culto de celebração', value: 'culto' },
  { label: 'Célula', value: 'celula' },
  { label: 'Ação social', value: 'social' }
]
</script>

<template>
  <div>
    <PageIntro
      title="Design System"
      description="Catálogo interativo dos padrões visuais e componentes reutilizados pela CEDA."
      icon="i-lucide-palette"
    />

    <UTabs
      :items="tabs"
      class="w-full"
    >
      <template #colors>
        <div class="grid gap-4 pt-5 sm:grid-cols-3">
          <UCard>
            <div class="h-20 rounded-xl bg-primary" />
            <p class="mt-3 font-medium">
              Primária · laranja
            </p>
            <p class="text-sm text-muted">
              Ação, foco e destaque.
            </p>
          </UCard>
          <UCard>
            <div class="h-20 rounded-xl bg-white ring ring-default" />
            <p class="mt-3 font-medium">
              Tema claro
            </p>
            <p class="text-sm text-muted">
              Superfícies leves e contraste legível.
            </p>
          </UCard>
          <UCard>
            <div class="h-20 rounded-xl bg-zinc-950" />
            <p class="mt-3 font-medium">
              Tema escuro
            </p>
            <p class="text-sm text-muted">
              Fundo profundo com a marca em evidência.
            </p>
          </UCard>
        </div>
      </template>

      <template #type>
        <div class="space-y-5 pt-5">
          <h1 class="text-4xl font-black tracking-tight">
            Título principal
          </h1>
          <h2 class="text-2xl font-bold">
            Título de seção
          </h2>
          <p class="max-w-2xl leading-7">
            Texto de leitura com contraste acessível e ritmo confortável para conteúdos, comunicados e informações da comunidade.
          </p>
          <p class="text-sm text-muted">
            Texto auxiliar, metadados e instruções de preenchimento.
          </p>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <UColorModeButton />
            <span class="text-sm text-muted">O tema pode ser alternado para validar os dois contextos.</span>
          </div>
        </div>
      </template>

      <template #forms>
        <div class="space-y-5 pt-5">
          <UAlert
            color="primary"
            variant="subtle"
            title="Controles de formulário"
            description="Todos usam os mesmos raios, foco, cores e espaçamento do projeto."
          />

          <UCard>
            <div class="grid gap-5 md:grid-cols-2">
              <UFormField
                label="Input de texto"
                hint="Nome ou título"
              >
                <UInput
                  v-model="textInput"
                  placeholder="Digite aqui"
                  icon="i-lucide-type"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Input de senha"
                hint="Com ação de visualizar"
              >
                <UInput
                  v-model="passwordInput"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="Sua senha"
                  class="w-full"
                >
                  <template #trailing>
                    <UButton
                      color="neutral"
                      variant="link"
                      size="sm"
                      :icon="showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                      :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
                      @click="showPassword = !showPassword"
                    />
                  </template>
                </UInput>
              </UFormField>

              <UFormField
                label="Dropdown"
                hint="Seleção única"
              >
                <USelect
                  v-model="selectValue"
                  :items="selectItems"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Calendário"
                hint="Seletor de data padrão"
              >
                <AppDatePicker v-model="dateValue" />
              </UFormField>

              <UFormField
                label="Área de texto"
                class="md:col-span-2"
              >
                <UTextarea
                  v-model="longText"
                  placeholder="Escreva uma mensagem, aviso ou descrição..."
                  :rows="4"
                  class="w-full"
                />
              </UFormField>

              <UFormField
                label="Validação"
                error="Exemplo de mensagem de erro do campo"
              >
                <UInput
                  model-value=""
                  placeholder="Campo obrigatório"
                  color="error"
                  highlight
                  class="w-full"
                />
              </UFormField>

              <div class="space-y-4 rounded-xl border border-default p-4">
                <UCheckbox
                  v-model="checkboxValue"
                  label="Aceito receber comunicados"
                  description="Opção marcada por padrão."
                />
                <USwitch
                  v-model="toggleValue"
                  label="Notificações ativadas"
                  description="Toggle para preferências instantâneas."
                  checked-icon="i-lucide-check"
                  unchecked-icon="i-lucide-x"
                />
              </div>
            </div>
          </UCard>
        </div>
      </template>

      <template #components>
        <div class="space-y-5 pt-5">
          <div class="grid gap-4 lg:grid-cols-2">
            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Botões e badges
                </h2>
              </template>
              <div class="flex flex-wrap gap-3">
                <UButton
                  label="Primário"
                  icon="i-lucide-plus"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  label="Secundário"
                />
                <UButton
                  variant="soft"
                  label="Suave"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  label="Discreto"
                />
                <UButton
                  loading
                  label="Carregando"
                />
                <UButton
                  disabled
                  label="Indisponível"
                />
              </div>
              <USeparator class="my-5" />
              <div class="flex flex-wrap gap-2">
                <UBadge label="Novo" />
                <UBadge
                  color="success"
                  variant="subtle"
                  label="Concluído"
                />
                <UBadge
                  color="warning"
                  variant="subtle"
                  label="Atenção"
                />
                <UBadge
                  color="error"
                  variant="subtle"
                  label="Pendente"
                />
              </div>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Avatar, progresso e separador
                </h2>
              </template>
              <div class="flex items-center gap-3">
                <UAvatar
                  fallback="CP"
                  size="xl"
                />
                <div>
                  <p class="font-medium">
                    Comunidade CEDA
                  </p>
                  <p class="text-sm text-muted">
                    Avatar com fallback por iniciais.
                  </p>
                </div>
              </div>
              <USeparator class="my-5" />
              <div class="space-y-2">
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium">Progresso</span>
                  <span class="text-muted">68%</span>
                </div>
                <UProgress :model-value="68" />
              </div>
            </UCard>

            <UCard class="lg:col-span-2">
              <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="font-semibold">
                    Calendário padrão
                  </h2>
                  <p class="mt-1 max-w-md text-sm text-muted">
                    Navegação, seleção e foco seguem a paleta e os estados da CEDA.
                  </p>
                </div>
                <UCalendar
                  :default-value="calendarDate"
                  size="sm"
                />
              </div>
            </UCard>
          </div>
        </div>
      </template>

      <template #feedback>
        <div class="space-y-5 pt-5">
          <div class="grid gap-3 md:grid-cols-2">
            <UAlert
              color="success"
              variant="subtle"
              title="Alterações salvas"
              description="Use para confirmar uma ação concluída."
            />
            <UAlert
              color="warning"
              variant="subtle"
              title="Atenção necessária"
              description="Use antes de uma decisão importante."
            />
            <UAlert
              color="error"
              variant="subtle"
              title="Não foi possível concluir"
              description="Explique o que aconteceu e como seguir."
            />
            <UAlert
              color="info"
              variant="subtle"
              title="Aviso informativo"
              description="Comunicação objetiva sem interromper o fluxo."
            />
          </div>

          <div class="grid gap-4 lg:grid-cols-2">
            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Estados de carregamento
                </h2>
              </template>
              <BrandLoader
                class="mb-5"
                label="Carregando conteúdo…"
              />
              <USkeleton class="h-6 w-2/3" />
              <USkeleton class="mt-3 h-4 w-full" />
              <USkeleton class="mt-2 h-4 w-5/6" />
              <p class="mt-4 text-sm text-muted">
                Preserve a estrutura enquanto o conteúdo carrega.
              </p>
            </UCard>

            <UCard>
              <template #header>
                <h2 class="font-semibold">
                  Modais
                </h2>
              </template>
              <p class="text-sm text-muted">
                Dois padrões para confirmar ações sensíveis e exibir comunicados.
              </p>
              <div class="mt-4 flex flex-wrap gap-2">
                <UButton
                  color="error"
                  variant="outline"
                  label="Modal de alerta"
                  icon="i-lucide-triangle-alert"
                  @click="alertModalOpen = true"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  label="Modal de avisos"
                  icon="i-lucide-bell"
                  @click="noticeModalOpen = true"
                />
              </div>
            </UCard>
          </div>
        </div>
      </template>
    </UTabs>

    <UModal
      v-model:open="alertModalOpen"
      title="Confirmar ação importante"
      description="Use este padrão quando a ação puder afetar dados ou pessoas."
    >
      <template #body>
        <UAlert
          color="warning"
          variant="subtle"
          title="Esta ação exige confirmação"
          description="Explique o impacto com clareza antes de oferecer a ação final."
        />
      </template>
      <template #footer>
        <div class="ml-auto flex gap-2">
          <UButton
            color="neutral"
            variant="outline"
            label="Cancelar"
            @click="alertModalOpen = false"
          />
          <UButton
            color="error"
            label="Confirmar"
            @click="alertModalOpen = false"
          />
        </div>
      </template>
    </UModal>

    <UModal
      v-model:open="noticeModalOpen"
      title="Avisos da comunidade"
      description="Padrão para comunicados que precisam de atenção sem caráter destrutivo."
    >
      <template #body>
        <div class="space-y-3">
          <UAlert
            color="primary"
            variant="subtle"
            title="Culto de celebração"
            description="Domingo, às 19h, no templo principal."
          />
          <UAlert
            color="info"
            variant="subtle"
            title="Atualização disponível"
            description="Os seus dados serão sincronizados no próximo acesso."
          />
        </div>
      </template>
      <template #footer>
        <UButton
          class="ml-auto"
          label="Entendi"
          @click="noticeModalOpen = false"
        />
      </template>
    </UModal>
  </div>
</template>
