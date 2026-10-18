<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Mensagens salvas' })
const saved = useSavedMessages()
onMounted(saved.load)
</script>

<template>
  <div>
    <PageIntro
      title="Mensagens salvas"
      description="Reencontre as palavras que você escolheu guardar. Sua lista acompanha sua conta."
      icon="i-lucide-bookmark"
    />
    <UAlert
      v-if="saved.errorMessage.value"
      class="mb-5"
      color="error"
      title="Não foi possível atualizar sua lista"
      :description="saved.errorMessage.value"
      :actions="[{ label: 'Tentar novamente', onClick: saved.load }]"
    />
    <div
      v-if="saved.loading.value"
      class="space-y-4"
      aria-busy="true"
      aria-label="Carregando mensagens salvas"
    >
      <USkeleton
        v-for="n in 3"
        :key="n"
        class="h-36 w-full rounded-xl"
      />
    </div>
    <UCard
      v-else-if="!saved.messages.value.length && !saved.errorMessage.value"
      class="py-6 text-center"
    >
      <UIcon
        name="i-lucide-bookmark"
        class="size-10 text-primary"
      />
      <h2 class="mt-3 text-lg font-semibold">
        Guarde uma palavra para reler depois
      </h2>
      <p class="mt-2 text-sm text-muted">
        Toque em “Salvar para depois” ao ler uma mensagem. Ela aparecerá aqui enquanto estiver publicada.
      </p>
      <UButton
        to="/palavra-do-dia"
        class="mt-5"
        label="Ler a palavra do dia"
      />
    </UCard>
    <div
      v-else
      class="grid gap-4 md:grid-cols-2"
    >
      <UCard
        v-for="message in saved.messages.value"
        :key="message.id"
      >
        <h2 class="text-lg font-semibold">
          {{ message.title }}
        </h2>
        <p class="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-muted">
          {{ message.content }}
        </p>
        <template #footer>
          <div class="flex flex-wrap gap-2">
            <UButton
              :to="`/mensagens/${encodeURIComponent(message.slug)}`"
              label="Ler mensagem"
              icon="i-lucide-book-open"
            />
            <UButton
              color="neutral"
              variant="outline"
              label="Remover dos salvos"
              :loading="saved.saving.value"
              @click="saved.toggle(message.slug)"
            />
          </div>
        </template>
      </UCard>
    </div>
  </div>
</template>
