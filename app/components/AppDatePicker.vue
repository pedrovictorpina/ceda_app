<script setup lang="ts">
import { parseDate, type DateValue } from '@internationalized/date'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string
  placeholder?: string
  min?: string
  max?: string
  size?: 'md' | 'lg' | 'xl'
}>(), {
  modelValue: '',
  placeholder: 'Selecionar data',
  min: '',
  max: '',
  size: 'md'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const open = ref(false)

const selectedDate = computed<DateValue | undefined>(() => {
  try {
    return props.modelValue ? parseDate(props.modelValue) : undefined
  } catch {
    return undefined
  }
})
const minimumDate = computed<DateValue | undefined>(() => props.min ? parseDate(props.min) : undefined)
const maximumDate = computed<DateValue | undefined>(() => props.max ? parseDate(props.max) : undefined)
function updateDate(value: unknown, close = false) {
  const date = value && !Array.isArray(value) && !('start' in (value as object))
    ? value as DateValue
    : undefined
  emit('update:modelValue', date?.toString() || '')
  if (close) open.value = false
}
</script>

<template>
  <UInputDate
    v-bind="$attrs"
    :model-value="selectedDate"
    :min-value="minimumDate"
    :max-value="maximumDate"
    :size="size"
    locale="pt-BR"
    granularity="day"
    :aria-label="typeof $attrs['aria-label'] === 'string' ? $attrs['aria-label'] : `${placeholder}. Digite dia, mês e ano ou abra o calendário.`"
    @update:model-value="updateDate($event)"
  >
    <template #trailing>
      <UPopover v-model:open="open">
        <UButton
          color="neutral"
          variant="ghost"
          size="lg"
          icon="i-lucide-calendar-days"
          :aria-label="`Abrir calendário: ${placeholder}`"
        />
        <template #content>
          <UCalendar
            :model-value="selectedDate"
            :min-value="minimumDate"
            :max-value="maximumDate"
            locale="pt-BR"
            @update:model-value="updateDate($event, true)"
          />
        </template>
      </UPopover>
    </template>
  </UInputDate>
</template>
