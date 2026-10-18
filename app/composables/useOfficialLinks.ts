import { officialEmailLink, officialMapLink, officialPhoneLink, officialWhatsAppLink } from '~/utils/officialContact'

export function useOfficialLinks() {
  const config = useRuntimeConfig()
  const website = computed(() => String(config.public.churchWebsiteUrl || ''))
  const instagram = computed(() => String(config.public.instagramUrl || ''))
  const youtube = computed(() => String(config.public.youtubeUrl || ''))
  const address = computed(() => String(config.public.churchAddress || ''))
  const phone = computed(() => String(config.public.churchPhone || '').trim())
  const email = computed(() => String(config.public.churchEmail || '').trim())
  const phoneLink = computed(() => officialPhoneLink(phone.value))
  const emailLink = computed(() => officialEmailLink(email.value))
  const whatsapp = computed(() => officialWhatsAppLink(String(config.public.churchWhatsapp || '')))
  const map = computed(() => officialMapLink(String(config.public.churchMapUrl || ''), address.value))
  return { website, instagram, youtube, address, phone, email, phoneLink, emailLink, whatsapp, map }
}
