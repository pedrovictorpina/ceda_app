import type { PublishedEditorialItem } from '~/composables/usePublishedEditorial'

export function editorialPreview(item: Pick<PublishedEditorialItem, 'title' | 'content' | 'slug' | 'message_date'>) {
  const paragraphs = item.content.split(/\n\s*\n/).map(text => text.trim()).filter(Boolean)
  return {
    ...item,
    excerpt: paragraphs[0] || '',
    body: paragraphs.slice(1),
    readTime: `${Math.max(1, Math.ceil(item.content.trim().split(/\s+/).filter(Boolean).length / 180))} min de leitura`
  }
}
