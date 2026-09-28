export const CHILD_PHOTO_BUCKET = 'child-photos'
export const CHILD_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const CHILD_PHOTO_SIGNED_URL_SECONDS = 60 * 60

const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp'
}

export const CHILD_PHOTO_ACCEPT = Object.keys(extensions).join(',')

export function validateChildPhoto(file: { type: string, size: number }): string | null {
  if (!extensions[file.type]) return 'Escolha uma foto JPG, PNG ou WebP.'
  if (file.size > CHILD_PHOTO_MAX_BYTES) return 'A foto deve ter até 5 MB.'
  return null
}

/** Caminho no bucket privado: sempre dentro da pasta da criança. */
export function childPhotoPath(childId: string, fileType: string, uniqueId: string): string {
  const extension = extensions[fileType]
  if (!extension) throw new Error('Formato de foto não suportado.')
  return `${childId}/${uniqueId}.${extension}`
}

export function childInitials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || '?'
}
