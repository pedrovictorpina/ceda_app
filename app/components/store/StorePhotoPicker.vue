<script setup lang="ts">
import { Capacitor } from '@capacitor/core'
import { Camera, CameraErrorCode } from '@capacitor/camera'
import { ref } from 'vue'

defineProps<{ inputKey: number }>()
const emit = defineEmits<{ file: [file: File] }>()
const native = ref(false)
const error = ref('')
const busy = ref(false)
const galleryInput = ref<{ inputRef: HTMLInputElement | null } | null>(null)
const cameraInput = ref<{ inputRef: HTMLInputElement | null } | null>(null)
onMounted(() => {
  native.value = Capacitor.isNativePlatform()
})
function fileSelected(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) acceptFile(file)
}
function acceptFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    error.value = 'Escolha uma foto JPG, PNG ou WebP de até 5 MB.'
    return
  }
  error.value = ''
  emit('file', file)
}
async function takePhoto() {
  if (busy.value) return
  error.value = ''
  if (!Capacitor.isPluginAvailable('Camera')) {
    error.value = 'A câmera não está disponível nesta versão do aplicativo. Atualize o aplicativo e tente novamente.'
    return
  }
  busy.value = true
  try {
    const result = await Camera.takePhoto({ quality: 85, targetWidth: 1600, targetHeight: 1600, saveToGallery: false })
    if (!result.webPath) throw new Error('Foto indisponível')
    const response = await fetch(result.webPath)
    if (!response.ok) throw new Error('Foto indisponível')
    const blob = await response.blob()
    acceptFile(new File([blob], 'produto.jpg', { type: blob.type || 'image/jpeg' }))
  } catch (cause) {
    const code = (cause as { code?: string }).code
    if (code !== CameraErrorCode.TakePhotoCancelled) {
      error.value = code === CameraErrorCode.CameraPermissionDenied
        ? 'Acesso à câmera negado. Permita o acesso nas configurações do aparelho e tente novamente.'
        : 'Não foi possível abrir a câmera ou ler a foto. Tente novamente.'
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="grid gap-3">
    <div class="flex flex-wrap justify-end gap-2">
      <UButton
        label="Selecionar arquivo"
        icon="i-lucide-image"
        variant="outline"
        color="neutral"
        class="min-h-11"
        @click="galleryInput?.inputRef?.click()"
      />
      <UButton
        label="Tirar foto"
        icon="i-lucide-camera"
        variant="outline"
        color="neutral"
        class="min-h-11"
        :loading="busy"
        @click="native ? takePhoto() : cameraInput?.inputRef?.click()"
      />
    </div>
    <UInput
      :key="`gallery-${inputKey}`"
      ref="galleryInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      class="hidden"
      hidden
      @change="fileSelected"
    />
    <UInput
      v-if="!native"
      :key="`camera-${inputKey}`"
      ref="cameraInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      class="hidden"
      hidden
      @change="fileSelected"
    />
    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :description="error"
    />
  </div>
</template>
