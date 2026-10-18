<script setup lang="ts">
import { authErrorMessage, authFlowLink, safeAuthReturnTo, validateAuthEmail } from '~/utils/authFlow'

definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Recuperar acesso' })
const auth = useAuthStore()
const route = useRoute()
const form = reactive({ email: '' })
const emailError = ref<string>()
const errorMessage = ref('')
const pending = ref(false)
const sent = ref(false)
const cooldown = ref(0)
const destination = computed(() => safeAuthReturnTo(route.query.next))
let timer: ReturnType<typeof setInterval> | undefined

onMounted(async () => {
  try {
    await auth.hydrate()
  } catch { /* Sending a recovery email does not require an existing session. */ }
})
onBeforeUnmount(() => clearInterval(timer))

async function submit() {
  emailError.value = validateAuthEmail(form.email)
  if (emailError.value || pending.value || cooldown.value) return
  pending.value = true
  errorMessage.value = ''
  try {
    await auth.requestPasswordReset(form.email, destination.value)
    sent.value = true
    cooldown.value = 60
    clearInterval(timer)
    timer = setInterval(() => {
      cooldown.value = Math.max(0, cooldown.value - 1)
      if (!cooldown.value) clearInterval(timer)
    }, 1000)
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'recovery')
  } finally { pending.value = false }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-10">
    <UCard class="w-full">
      <template #header>
        <BrandLogo
          variant="auth"
          class="mb-4 flex"
        />
        <h1 class="text-2xl font-bold">
          Recuperar acesso
        </h1>
        <p class="mt-2 text-sm leading-6 text-muted">
          Informe o e-mail do seu cadastro. Enviaremos um link para você escolher uma nova senha.
        </p>
      </template>
      <UForm
        :state="form"
        class="space-y-4"
        novalidate
        @submit="submit"
      >
        <UAlert
          v-if="sent"
          color="success"
          variant="subtle"
          icon="i-lucide-mail-check"
          title="Confira seu e-mail"
          description="Se existe uma conta com esse e-mail, você receberá um link para criar outra senha. Confira também o spam e abra o link neste mesmo navegador."
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          title="Não conseguimos enviar"
          :description="errorMessage"
        />
        <UAlert
          v-if="!auth.loading && !auth.configured"
          color="warning"
          variant="subtle"
          title="Recuperação temporariamente indisponível"
          description="Tente novamente mais tarde. Os horários e contatos da igreja continuam disponíveis sem entrar."
        />
        <UFormField
          label="E-mail do cadastro"
          name="email"
          required
          :error="emailError"
        >
          <UInput
            v-model="form.email"
            type="email"
            inputmode="email"
            autocomplete="email"
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          block
          :loading="pending"
          :disabled="!auth.configured || cooldown > 0"
          :label="cooldown ? `Reenviar em ${cooldown}s` : sent ? 'Enviar outro link' : 'Enviar link de recuperação'"
        />
        <p
          v-if="sent"
          class="text-sm leading-6 text-muted"
        >
          Ainda não chegou? Confirme se digitou o e-mail correto e aguarde alguns minutos.
          Ao pedir outro link, use sempre a mensagem mais recente.
        </p>
        <UButton
          :to="authFlowLink('/entrar', destination)"
          block
          color="neutral"
          variant="outline"
          icon="i-lucide-arrow-left"
          label="Voltar para entrar"
        />
        <UButton
          to="/contato"
          block
          variant="link"
          label="Preciso de ajuda da recepção"
        />
      </UForm>
    </UCard>
  </section>
</template>
