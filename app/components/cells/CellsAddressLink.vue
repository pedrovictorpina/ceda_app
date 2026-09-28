<script setup lang="ts">
import { cellAreaLabel, googleMapsUrl, type CellAddressParts } from '~/utils/cellAddress'

const props = withDefaults(defineProps<{ address: CellAddressParts, hiddenNote?: boolean }>(), { hiddenNote: false })

const mapsUrl = computed(() => googleMapsUrl(props.address))
const area = computed(() => cellAreaLabel(props.address))
</script>

<template>
  <div v-if="address.addressLine || area">
    <a
      v-if="mapsUrl"
      :href="mapsUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="focus-ring group -mx-2 flex min-h-11 items-start gap-3 rounded-2xl px-2 py-2 hover:bg-primary/5"
      :aria-label="`Abrir ${address.addressLine || area} no Google Maps`"
    >
      <span class="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <UIcon
          name="i-lucide-map-pin"
          class="size-5"
        />
      </span>
      <span class="min-w-0 flex-1">
        <span
          v-if="address.addressLine"
          class="block font-medium"
        >{{ address.addressLine }}</span>
        <span
          class="block text-sm"
          :class="address.addressLine ? 'text-muted' : 'font-medium'"
        >{{ area }}<template v-if="address.postalCode"> · CEP {{ address.postalCode }}</template></span>
        <span class="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
          Abrir no Maps
          <UIcon
            name="i-lucide-external-link"
            class="size-3.5"
          />
        </span>
      </span>
    </a>
    <p
      v-if="hiddenNote && !address.addressLine"
      class="mt-1 text-xs text-muted"
    >
      A liderança compartilha o endereço completo com quem pedir para visitar.
    </p>
  </div>
  <p
    v-else
    class="text-sm text-muted"
  >
    Endereço ainda não cadastrado.
  </p>
</template>
