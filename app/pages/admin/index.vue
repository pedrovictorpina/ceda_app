<script setup lang="ts">
import { dashboardShortcuts } from '~/utils/adminDashboard'
import { urgentCount } from '~/utils/adminDashboardAttention'
import type { DashboardPeriod } from '~/utils/adminDashboardDates'

definePageMeta({ layout: 'admin', middleware: ['auth', 'admin'] })
useSeoMeta({ title: 'Administração' })

const auth = useAuthStore()
const dashboard = useAdminDashboard()
const {
  period,
  updatedAt,
  refreshing,
  members,
  sales,
  children,
  events,
  cells,
  birthdays,
  visits,
  attention,
  attentionLoading,
  attentionFailures
} = dashboard

const shortcuts = computed(() => dashboardShortcuts(auth.profile))
const urgent = computed(() => urgentCount(attention.value))
const urgentAreas = computed(() => attention.value.filter(item => item.tone === 'warning').length)
const unavailableAreas = computed(() => [
  ...(visits.value.status === 'unavailable' ? ['Pedidos de visita às células'] : [])
])

function changePeriod(value: DashboardPeriod) {
  void dashboard.setPeriod(value)
}

onMounted(() => {
  void dashboard.refresh()
})
</script>

<template>
  <div>
    <PageIntro
      title="Visão administrador"
      description="Pendências, números da comunidade e atalhos para a gestão da CEDA."
      icon="i-lucide-layout-dashboard"
    />

    <AdminDashboardToolbar
      :period="period"
      :updated-at="updatedAt"
      :refreshing="refreshing"
      @update:period="changePeriod"
      @refresh="dashboard.refresh"
    />

    <AdminDashboardSummary
      :period="period"
      :members="members"
      :sales="sales"
      :events="events"
      :cells="cells"
      :children="children"
      :birthdays="birthdays"
      :urgent="urgent"
      :attention-areas="urgentAreas"
      :attention-loading="attentionLoading"
    />

    <div class="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <AdminDashboardAttention
        :items="attention"
        :loading="attentionLoading"
        :failures="attentionFailures"
        :unavailable="unavailableAreas"
      />
      <AdminDashboardShortcuts :items="shortcuts" />
    </div>

    <AdminDashboardCharts
      class="mt-8"
      :period="period"
      :members="members"
      :sales="sales"
      :children="children"
    />
  </div>
</template>
