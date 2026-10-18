export const CHURCH_ADDRESS = 'R. Tibúrcio de Azevedo, 305 - Americana, Alvorada - RS, 94820-480'

/** Public church contacts only. No member or leader contact is used as a substitute. */
export function officialPhoneLink(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? `tel:+${digits}` : ''
}

export function officialWhatsAppLink(value: string): string {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? `https://wa.me/${digits}` : ''
}

export function officialEmailLink(value: string): string {
  const email = value.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !/[%?&#]/.test(email) ? `mailto:${email}` : ''
}

export function officialMapLink(url: string, address: string): string {
  if (url.trim()) {
    try {
      const parsed = new URL(url.trim())
      if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href
    } catch { /* An invalid configured URL should not become a broken action. */ }
  }
  return address.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}` : ''
}
