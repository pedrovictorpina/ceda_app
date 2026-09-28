import type { CellMemberCandidate, CellVisitRequest, CellVisitStatus } from '~/types/cells'
import { cellErrorMessage, MEMBER_SEARCH_MIN, mapMemberCandidates, mapVisitRequestRows } from '~/utils/cellDirectory'

/** Pedidos de visita de uma célula, para a liderança e a administração. */
export function useCellVisitRequests() {
  const items = ref<CellVisitRequest[]>([])
  const loading = ref(false)
  const busyId = ref('')
  const error = ref('')
  const { resolveAvatars } = useAvatarUrls()

  async function load(cellId: string) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return
    loading.value = true
    error.value = ''
    try {
      const { data, error: rpcError } = await $supabase.rpc('list_cell_visit_requests', { p_cell_id: cellId })
      if (rpcError) throw rpcError
      items.value = mapVisitRequestRows(data)
      await resolveAvatars(items.value.map(item => item.requesterAvatarPath))
    } catch (caught) {
      items.value = []
      error.value = cellErrorMessage(caught, 'Não foi possível carregar os pedidos de visita.')
    } finally {
      loading.value = false
    }
  }

  async function setStatus(cellId: string, requestId: string, status: Exclude<CellVisitStatus, 'pending'>) {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return
    busyId.value = requestId
    error.value = ''
    try {
      const { error: rpcError } = await $supabase.rpc('update_cell_visit_request', { p_request_id: requestId, p_status: status })
      if (rpcError) throw rpcError
      await load(cellId)
    } catch (caught) {
      error.value = cellErrorMessage(caught, 'Não foi possível atualizar o pedido.')
    } finally {
      busyId.value = ''
    }
  }

  return { items, loading, busyId, error, load, setStatus }
}

/** Busca de pessoas cadastradas para a liderança adicionar à célula. */
export function useCellMemberSearch() {
  const results = ref<CellMemberCandidate[]>([])
  const lastQuery = ref('')
  const searching = ref(false)
  const error = ref('')
  const { resolveAvatars } = useAvatarUrls()
  let requestId = 0

  async function search(cellId: string, query: string) {
    const { $supabase } = useNuxtApp()
    const current = ++requestId
    error.value = ''
    if (query.trim().length < MEMBER_SEARCH_MIN || !$supabase) {
      results.value = []
      return
    }
    searching.value = true
    try {
      const { data, error: rpcError } = await $supabase.rpc('search_members_for_cell', { p_cell_id: cellId, p_query: query.trim().slice(0, 60) })
      if (current !== requestId) return
      if (rpcError) throw rpcError
      results.value = mapMemberCandidates(data)
      lastQuery.value = query.trim()
      await resolveAvatars(results.value.map(item => item.avatarPath))
    } catch (caught) {
      if (current !== requestId) return
      results.value = []
      error.value = cellErrorMessage(caught, 'Não foi possível buscar agora. Tente novamente.')
    } finally {
      if (current === requestId) searching.value = false
    }
  }

  function clear() {
    requestId++
    results.value = []
    lastQuery.value = ''
    searching.value = false
  }

  return { results, lastQuery, searching, error, search, clear }
}
