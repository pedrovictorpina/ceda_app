<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Início' })
</script>

<template>
  <div>
    <PageIntro
      title="Olá, seja bem-vindo"
      description="Acompanhe a mensagem do dia e os próximos encontros."
      icon="i-lucide-house"
    />
    <div class="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <UBadge label="Mensagem do dia" /><span class="text-xs text-muted">Publicada hoje</span>
          </div>
        </template><h2 class="text-2xl font-bold">
          Um passo de cada vez
        </h2><p class="mt-3 text-muted">
          O conteúdo publicado pelo pastor ou administrador aparecerá aqui, com rota própria para compartilhamento.
        </p><template #footer>
          <UButton
            to="/mensagens/exemplo"
            variant="soft"
            label="Ler mensagem"
            trailing-icon="i-lucide-arrow-right"
          />
        </template>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-semibold">
            Próximos eventos
          </h2>
        </template><div class="space-y-4">
          <div>
            <p class="font-medium">
              Culto de celebração
            </p><p class="text-sm text-muted">
              Domingo · 19h · Templo
            </p>
          </div><USeparator /><div>
            <p class="font-medium">
              Encontro de voluntários
            </p><p class="text-sm text-muted">
              Quarta · 20h · Sala multiuso
            </p>
          </div>
        </div><template #footer>
          <UButton
            to="/eventos"
            color="neutral"
            variant="outline"
            label="Ver calendário"
          />
        </template>
      </UCard>
    </div>
  </div>
</template>
