export interface GallerySource {
  provider: string
  url: string
  configured: boolean
}

export function getGallerySource(config: { galleryProvider?: unknown, galleryUrl?: unknown }): GallerySource {
  const url = typeof config.galleryUrl === 'string' ? config.galleryUrl.trim() : ''
  return { provider: typeof config.galleryProvider === 'string' ? config.galleryProvider : 'web', url, configured: /^https:\/\//.test(url) }
}
