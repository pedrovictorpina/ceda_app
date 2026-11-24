<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({ middleware: ['auth', 'operations'] })
useSeoMeta({ title: 'Saídas e doações' })

const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const inicio = ref(`${hoje.slice(0, 7)}-01`)
const fim = ref(hoje)
const periodo = ref({ inicio: inicio.value, fim: fim.value })
const erro = ref('')
const filtrosAbertos = ref(false)

const aplicar = () => {
  if (!inicio.value || !fim.value || inicio.value > fim.value) {
    erro.value = 'Informe um período válido.'
    return
  }
  erro.value = ''
  periodo.value = { inicio: inicio.value, fim: fim.value }
  filtrosAbertos.value = false
}
</script>

<template>
  <div>
    <h1 class="text-lg font-bold sm:text-2xl">
      Saídas e doações
    </h1>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <UButton
        label="Período"
        icon="i-lucide-sliders-horizontal"
        color="neutral"
        variant="outline"
        @click="filtrosAbertos = true"
      />
      <span class="text-sm text-muted">{{ periodo.inicio.split('-').reverse().join('/') }} a {{ periodo.fim.split('-').reverse().join('/') }}</span>
    </div>
    <UModal
      v-model:open="filtrosAbertos"
      title="Período dos lançamentos"
      description="Escolha o período para consultar saídas e doações."
    >
      <template #body>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Data inicial">
            <AppDatePicker
              v-model="inicio"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Data final">
            <AppDatePicker
              v-model="fim"
              class="w-full"
            />
          </UFormField>
        </div>
        <UAlert
          v-if="erro"
          class="mt-4"
          color="error"
          variant="subtle"
          :description="erro"
        />
        <div class="mt-4 flex justify-end">
          <UButton
            label="Aplicar período"
            icon="i-lucide-filter"
            @click="aplicar"
          />
        </div>
      </template>
    </UModal>
    <StoreFinanceLedger
      :start="periodo.inicio"
      :end="periodo.fim"
      mode="entries"
    />
  </div>
</template>
