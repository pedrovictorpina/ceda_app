<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Feed' })

const liked = ref(false)
const commentsOpen = ref(false)
const comment = ref('')
const comments = ref<string[]>(['Que alegria caminhar com essa comunidade!'])
const shared = ref(false)

function addComment() {
  if (!comment.value.trim()) return
  comments.value.push(comment.value.trim())
  comment.value = ''
}

async function sharePost() {
  if (navigator.share) await navigator.share({ title: 'CEDA', text: 'Bem-vindos à nossa comunidade digital', url: window.location.href })
  else await navigator.clipboard.writeText(window.location.href)
  shared.value = true
}
</script>

<template>
  <div>
    <PageIntro
      title="Feed"
      description="Publicações, histórias e conversas que aproximam a comunidade."
      icon="i-lucide-messages-square"
    />
    <div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
      <div class="space-y-5">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <UAvatar fallback="CM" /><div>
                  <p class="font-semibold">
                    Comunicação CEDA
                  </p><p class="text-xs text-muted">
                    Hoje · Publicação oficial
                  </p>
                </div>
              </div><UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-ellipsis"
                aria-label="Mais opções"
              />
            </div>
          </template>
          <div class="grid aspect-[16/7] place-items-center rounded-xl bg-gradient-to-br from-primary/15 via-primary/5 to-elevated">
            <div class="text-center">
              <UIcon
                name="i-lucide-users-round"
                class="mx-auto size-12 text-primary"
              /><p class="mt-3 font-semibold text-primary">
                Gente cuidando de gente
              </p>
            </div>
          </div>
          <h2 class="mt-5 text-xl font-bold">
            Bem-vindos à nossa comunidade digital
          </h2>
          <p class="mt-2 leading-7 text-muted">
            Este é um espaço para acompanhar o que estamos vivendo, celebrar histórias e encontrar novas formas de participar. Fique à vontade para interagir.
          </p>
          <div class="mt-5 flex items-center justify-between border-t border-default pt-4 text-sm text-muted">
            <span>{{ liked ? 13 : 12 }} curtidas</span><button
              class="hover:text-default"
              @click="commentsOpen = true"
            >
              {{ comments.length }} comentário{{ comments.length === 1 ? '' : 's' }}
            </button>
          </div>
          <template #footer>
            <div class="grid grid-cols-3 gap-1">
              <UButton
                color="neutral"
                variant="ghost"
                :icon="liked ? 'i-lucide-heart' : 'i-lucide-heart'"
                :class="liked ? 'text-primary' : ''"
                :label="liked ? 'Curtido' : 'Curtir'"
                @click="liked = !liked"
              />
              <UButton
                color="neutral"
                variant="ghost"
                icon="i-lucide-message-circle"
                label="Comentar"
                @click="commentsOpen = true"
              />
              <UButton
                color="neutral"
                variant="ghost"
                :icon="shared ? 'i-lucide-check' : 'i-lucide-share-2'"
                :label="shared ? 'Copiado' : 'Compartilhar'"
                @click="sharePost"
              />
            </div>
          </template>
        </UCard>
      </div>

      <aside class="space-y-4">
        <UCard>
          <h2 class="font-semibold">
            Explore a comunidade
          </h2><div class="mt-4 space-y-3">
            <NuxtLink
              v-for="link in [{ label: 'Próximos eventos', to: '/eventos', icon: 'i-lucide-calendar-days' }, { label: 'Grupos e ministérios', to: '/comunidade', icon: 'i-lucide-users' }, { label: 'Campanhas ativas', to: '/campanhas', icon: 'i-lucide-hand-coins' }]"
              :key="link.to"
              :to="link.to"
              class="focus-ring flex items-center gap-3 rounded-lg p-2 text-sm font-medium hover:bg-elevated"
            ><UIcon
              :name="link.icon"
              class="size-5 text-primary"
            />{{ link.label }}<UIcon
              name="i-lucide-chevron-right"
              class="ml-auto size-4 text-muted"
            /></NuxtLink>
          </div>
        </UCard>
        <UCard class="bg-primary/5">
          <UIcon
            name="i-lucide-shield-check"
            class="size-6 text-primary"
          /><h2 class="mt-3 font-semibold">
            Um espaço respeitoso
          </h2><p class="mt-2 text-sm leading-6 text-muted">
            Compartilhe com cuidado. Informações pessoais e pedidos sensíveis pertencem aos canais privados.
          </p>
        </UCard>
      </aside>
    </div>

    <UModal
      v-model:open="commentsOpen"
      title="Comentários"
      description="Participe da conversa com respeito."
    >
      <template #body>
        <div class="space-y-4">
          <div
            v-for="(item, index) in comments"
            :key="`${item}-${index}`"
            class="rounded-xl bg-elevated p-4"
          >
            <div class="flex items-center gap-2">
              <UAvatar
                fallback="ME"
                size="xs"
              /><p class="text-sm font-medium">
                Membro da comunidade
              </p>
            </div><p class="mt-2 text-sm text-muted">
              {{ item }}
            </p>
          </div>
          <form
            class="flex gap-2"
            @submit.prevent="addComment"
          >
            <UInput
              v-model="comment"
              class="flex-1"
              placeholder="Escreva um comentário"
              aria-label="Novo comentário"
            /><UButton
              type="submit"
              icon="i-lucide-send"
              :disabled="!comment.trim()"
              aria-label="Enviar comentário"
            />
          </form>
        </div>
      </template>
    </UModal>
  </div>
</template>
