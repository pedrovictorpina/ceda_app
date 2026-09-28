import { mapBirthdayRows, todayInTimeZone, type BirthdayPeriod, type BirthdayPerson } from '~/utils/birthdays'

const AVATAR_URL_TTL_SECONDS = 60 * 60

/** Aniversariantes (somente quem consentiu) via RPC list_birthdays, com fotos assinadas do bucket privado. */
export function useBirthdays() {
  const people = ref<BirthdayPerson[]>([])
  const avatarUrls = ref<Record<string, string>>({})
  const loading = ref(false)
  const error = ref('')
  const today = ref(todayInTimeZone())
  let requestId = 0

  async function signAvatars(list: readonly BirthdayPerson[]) {
    const { $supabase } = useNuxtApp()
    const paths = [...new Set(list.flatMap(person => person.avatarPath ? [person.avatarPath] : []))]
    if (!$supabase || !paths.length) return {}
    const { data, error: signError } = await $supabase.storage.from('avatars').createSignedUrls(paths, AVATAR_URL_TTL_SECONDS)
    if (signError || !data) return {}
    const byPath = new Map(data.flatMap(item => item.path && item.signedUrl ? [[item.path, item.signedUrl] as const] : []))
    return Object.fromEntries(list.flatMap((person) => {
      const url = person.avatarPath ? byPath.get(person.avatarPath) : undefined
      return url ? [[person.id, url]] : []
    }))
  }

  async function load(period: BirthdayPeriod) {
    const { $supabase } = useNuxtApp()
    const current = ++requestId
    today.value = todayInTimeZone()
    if (!$supabase) {
      error.value = 'Não foi possível carregar os aniversariantes porque o serviço de dados está indisponível.'
      return
    }
    loading.value = true
    error.value = ''
    const { data, error: rpcError } = await $supabase.rpc('list_birthdays', { p_period: period })
    if (current !== requestId) return
    if (rpcError) {
      people.value = []
      avatarUrls.value = {}
      error.value = 'Não foi possível carregar os aniversariantes. Verifique sua conexão e tente novamente.'
      loading.value = false
      return
    }
    const list = mapBirthdayRows(data)
    // Fotos são opcionais: se a assinatura falhar, a lista mostra as iniciais.
    const urls = await signAvatars(list).catch(() => ({}))
    if (current !== requestId) return
    people.value = list
    avatarUrls.value = urls
    loading.value = false
  }

  return { people, avatarUrls, loading, error, today, load }
}
