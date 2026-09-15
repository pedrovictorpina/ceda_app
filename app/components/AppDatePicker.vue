<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  max?: string
}>(), {
  modelValue: '',
  placeholder: 'Selecionar data',
  max: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)

const selectedDate = computed<DateValue | undefined>(() => props.modelValue ? parseDate(props.modelValue) : undefined)
const maximumDate = computed<DateValue | undefined>(() => props.max ? parseDate(props.max) : undefined)
const displayValue = computed(() => {
  if (!props.modelValue) return props.placeholder
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(`${props.modelValue}T00:00:00`))
})

function selectDate(value: unknown) {
  const date = value && !Array.isArray(value) && !('start' in (value as object))
    ? value as DateValue
    : undefined
  emit('update:modelValue', date?.toString() || '')
  open.value = false
}
</script>

<template>
  <UPopover v-model:open="open">
    <UButton
      color="neutral"
      variant="outline"
      block
      class="justify-start"
      icon="i-lucide-calendar-days"
      :label="displayValue"
    />
    <template #content>
      <UCalendar
        :model-value="selectedDate"
        :max-value="maximumDate"
        @update:model-value="selectDate"
      />
    </template>
  </UPopover>
</template>
