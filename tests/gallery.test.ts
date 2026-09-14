import { describe, expect, it } from 'vitest'
import { getGallerySource } from '../app/services/gallery'

describe('gallery adapter configuration', () => {
  it('is disabled without an external HTTPS URL', () => {
    expect(getGallerySource({ galleryProvider: 'web', galleryUrl: '' }).configured).toBe(false)
    expect(getGallerySource({ galleryProvider: 'web', galleryUrl: 'http://unsafe.test' }).configured).toBe(false)
  })

  it('accepts a replaceable HTTPS provider', () => {
    expect(getGallerySource({ galleryProvider: 'drive', galleryUrl: 'https://example.test/gallery' })).toEqual({ provider: 'drive', url: 'https://example.test/gallery', configured: true })
  })
})
