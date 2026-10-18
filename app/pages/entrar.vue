<script setup lang="ts">
import { authDestinationLabel, authErrorMessage, authFlowLink, safeAuthReturnTo, validateAuthEmail } from '~/utils/authFlow'

definePageMeta({ layout: 'public' })
useSeoMeta({ title: 'Entrar' })
const auth = useAuthStore()
const route = useRoute()
const form = reactive({ email: '', password: '', rememberAccess: true })
const pending = ref(false)
const errorMessage = ref(route.query.motivo === 'verificar' ? 'Não foi possível verificar seu acesso. Confira sua conexão e entre novamente para continuar de onde parou.' : '')
const errors = ref<{ email?: string, password?: string }>({})
const confirmationSent = ref(false)
const confirmationPending = ref(false)
const canResendConfirmation = ref(false)
const passwordVisible = ref(false)
const destination = computed(() => safeAuthReturnTo(route.query.next))

onMounted(async () => {
  try {
    await auth.hydrate()
    form.rememberAccess = auth.rememberAccess
    if (auth.profile) await navigateTo(destination.value, { replace: true })
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'session')
  }
})

async function submit() {
  errors.value = { email: validateAuthEmail(form.email), password: form.password ? undefined : 'Informe sua senha.' }
  if (errors.value.email || errors.value.password || pending.value) return
  pending.value = true
  errorMessage.value = ''
  confirmationSent.value = false
  canResendConfirmation.value = false
  try {
    await auth.signIn(form.email, form.password, form.rememberAccess)
    await navigateTo(destination.value)
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'signIn')
    canResendConfirmation.value = Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'email_not_confirmed')
  } finally { pending.value = false }
}

async function resendConfirmation() {
  errors.value = { email: validateAuthEmail(form.email) }
  if (errors.value.email || confirmationPending.value) return
  confirmationPending.value = true
  try {
    await auth.resendConfirmation(form.email, destination.value)
    confirmationSent.value = true
    canResendConfirmation.value = false
    errorMessage.value = ''
  } catch (error) {
    errorMessage.value = authErrorMessage(error, 'recovery')
  } finally { confirmationPending.value = false }
}
</script>

<template>
  <section class="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center px-4 py-12">
    <BrandLoadingScreen
      v-if="pending"
      label="Entrando…"
    />
    <UCard class="w-full">
      <template #header>
        <BrandLogo
          variant="auth"
          class="mb-4 flex"
        />
        <h1 class="text-2xl font-bold">
          Área de membros
        </h1><p class="mt-1 text-sm text-muted">
          Entre com o e-mail cadastrado.
        </p>
      </template>
      <UForm
        :state="form"
        class="space-y-4"
        novalidate
        @submit="submit"
      >
        <UAlert
          v-if="!auth.loading && !auth.configured"
          color="warning"
          variant="subtle"
          title="Entrada temporariamente indisponível"
          description="Você pode consultar os horários e os contatos da igreja sem entrar. Tente acessar sua conta novamente mais tarde."
        />
        <UAlert
          v-if="route.query.next"
          color="info"
          variant="subtle"
          icon="i-lucide-lock-keyhole"
          title="Continue de onde parou"
          :description="`Entre na sua conta para continuar para ${authDestinationLabel(destination)}. Depois do acesso, abrimos essa página para você.`"
        />
        <UAlert
          v-if="route.query.cadastro === 'confirmado' || confirmationSent"
          color="success"
          variant="subtle"
          :title="confirmationSent ? 'Confira seu e-mail' : 'Confirmação recebida'"
          :description="confirmationSent ? 'Se houver um cadastro pendente para esse e-mail, você receberá um novo link. Confira também o spam e abra o link neste navegador.' : 'Se o e-mail foi confirmado, entre com sua senha para continuar.'"
        />
        <UAlert
          v-if="errorMessage"
          color="error"
          variant="subtle"
          :description="errorMessage"
        />
        <UFormField
          label="E-mail"
          required
          name="email"
          :error="errors.email"
        >
          <UInput
            v-model="form.email"
            type="email"
            autocomplete="email"
            inputmode="email"
            class="w-full"
          />
        </UFormField>
        <UFormField
          label="Senha"
          required
          name="password"
          :error="errors.password"
        >
          <UInput
            v-model="form.password"
            :type="passwordVisible ? 'text' : 'password'"
            autocomplete="current-password"
            class="w-full"
          >
            <template #trailing>
              <UButton
                type="button"
                color="neutral"
                variant="ghost"
                size="xs"
                :icon="passwordVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :aria-label="passwordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                :title="passwordVisible ? 'Ocultar senha' : 'Mostrar senha'"
                @click="passwordVisible = !passwordVisible"
              />
            </template>
          </UInput>
        </UFormField>
        <div class="flex justify-end">
          <UButton
            :to="authFlowLink('/recuperar-senha', destination)"
            variant="link"
            class="min-h-11 px-0"
            label="Esqueci minha senha"
          />
        </div>
        <UButton
          v-if="canResendConfirmation"
          variant="soft"
          block
          :loading="confirmationPending"
          label="Reenviar confirmação de e-mail"
          @click="resendConfirmation"
        />
        <UCheckbox
          v-model="form.rememberAccess"
          label="Lembrar meu acesso"
          description="Mantém a sessão neste dispositivo, inclusive após atualizações. A senha nunca é armazenada."
        />
        <UButton
          type="submit"
          block
          :loading="pending"
          :disabled="!auth.configured || confirmationPending"
          label="Entrar"
        />
        <p class="text-center text-sm text-muted">
          Ainda não tem uma conta?
          <ULink
            :to="authFlowLink('/cadastro', destination)"
            class="focus-ring rounded-sm font-medium text-primary hover:underline"
          >Criar cadastro</ULink>
        </p>
      </UForm>
    </UCard>
  </section>
</template>
