export function useOfficialLinks() {
  const config = useRuntimeConfig()
  const website = computed(() => String(config.public.churchWebsiteUrl || ''))
  const instagram = computed(() => String(config.public.instagramUrl || ''))
  const address = computed(() => String(config.public.churchAddress || ''))
  return { website, instagram, address }
}
