<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useSeoMeta({ title: 'Perfil' })
const auth = useAuthStore()
const form = reactive({ name: auth.profile?.name || '', email: auth.profile?.email || '', phone: '', sex: '', birthDate: '', emailNotifications: true })
const confirmDeletion = ref(false)
const requestStatus = ref('')

async function requestDeletion() {
  if (!confirmDeletion.value || !auth.profile) return
  const { $supabase } = useNuxtApp()
  if (!$supabase) {
    requestStatus.value = 'Supabase não configurado; nenhuma solicitação foi enviada.'
    return
  }
  const { error } = await $supabase.from('account_deletion_requests').insert({ user_id: auth.profile.id, confirmed_at: new Date().toISOString() })
  requestStatus.value = error ? error.message : 'Solicitação registrada para análise administrativa.'
}
</script>

<template>
  <div>
    <PageIntro
      title="Perfil"
      description="Seus dados pessoais. A idade é sempre derivada da data de nascimento."
      icon="i-lucide-user-round"
    /><div class="space-y-5">
      <UCard class="max-w-2xl">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Nome">
            <UInput
              v-model="form.name"
              class="w-full"
            />
          </UFormField><UFormField label="E-mail">
            <UInput
              v-model="form.email"
              type="email"
              class="w-full"
            />
          </UFormField><UFormField label="Telefone">
            <UInput
              v-model="form.phone"
              type="tel"
              class="w-full"
            />
          </UFormField><UFormField label="Sexo">
            <USelect
              v-model="form.sex"
              :items="['Feminino', 'Masculino', 'Prefiro não informar']"
              class="w-full"
            />
          </UFormField><UFormField label="Data de nascimento">
            <UInput
              v-model="form.birthDate"
              type="date"
              class="w-full"
            />
          </UFormField><UCheckbox
            v-model="form.emailNotifications"
            label="Receber avisos por e-mail"
          />
        </div><template #footer>
          <UButton label="Salvar alterações" /><p class="mt-2 text-xs text-muted">
            Persistência será ativada após configurar o Supabase local.
          </p>
        </template>
      </UCard><UCard class="max-w-2xl border-error/30">
        <h2 class="font-semibold text-error">
          Exclusão da conta
        </h2><p class="mt-2 text-sm text-muted">
          A solicitação abre uma análise administrativa. Nenhum usuário ou dado é apagado automaticamente.
        </p><UCheckbox
          v-model="confirmDeletion"
          class="mt-4"
          label="Confirmo que desejo solicitar a exclusão da minha conta"
        /><UButton
          class="mt-4"
          color="error"
          variant="outline"
          :disabled="!confirmDeletion"
          label="Solicitar exclusão da conta"
          @click="requestDeletion"
        /><UAlert
          v-if="requestStatus"
          class="mt-4"
          color="neutral"
          variant="subtle"
          :description="requestStatus"
        />
      </UCard>
    </div>
  </div>
</template>
