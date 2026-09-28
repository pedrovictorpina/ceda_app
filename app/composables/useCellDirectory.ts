import type { CellDirectoryEntry, CellVisitFormValue } from '~/types/cells'
import { cellErrorMessage, mapDirectoryRows } from '~/utils/cellDirectory'
import { DEMO_DIRECTORY } from '~/utils/cellsDemo'

/** Diretório de células ativas (RPC list_cell_directory) e pedidos de visita do membro. */
export function useCellDirectory() {
  const entries = ref<CellDirectoryEntry[]>([])
  const loading = ref(false)
  const sending = ref(false)
  const error = ref('')
  const demo = ref(false)
  const { resolveAvatars } = useAvatarUrls()
  let requestId = 0

  async function load(cellId?: string) {
    const { $supabase } = useNuxtApp()
    const current = ++requestId
    error.value = ''
    if (!$supabase) {
      demo.value = true
      entries.value = cellId ? DEMO_DIRECTORY.filter(entry => entry.id === cellId) : DEMO_DIRECTORY
      return
    }
    loading.value = true
    try {
      const { data, error: rpcError } = await $supabase.rpc('list_cell_directory', cellId ? { p_cell_id: cellId } : {})
      if (current !== requestId) return
      if (rpcError) throw rpcError
      entries.value = mapDirectoryRows(data)
      await resolveAvatars(entries.value.flatMap(entry => entry.leaders.map(leader => leader.avatarPath)))
    } catch (caught) {
      if (current !== requestId) return
      entries.value = []
      error.value = cellErrorMessage(caught, 'Não foi possível carregar as células. Verifique sua conexão e tente novamente.')
    } finally {
      if (current === requestId) loading.value = false
    }
  }

  function replaceVisit(cellId: string, visit: CellDirectoryEntry['myVisitRequest']) {
    entries.value = entries.value.map(entry => entry.id === cellId ? { ...entry, myVisitRequest: visit } : entry)
  }

  async function requestVisit(cellId: string, form: CellVisitFormValue): Promise<boolean> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) {
      error.value = 'Pedidos de visita exigem uma sessão real conectada ao Supabase.'
      return false
    }
    sending.value = true
    error.value = ''
    try {
      const { data, error: rpcError } = await $supabase.rpc('request_cell_visit', {
        p_cell_id: cellId,
        p_message: form.message.trim() || null,
        p_preferred_date: form.preferredDate || null,
        p_share_phone: form.sharePhone
      })
      if (rpcError) throw rpcError
      replaceVisit(cellId, { id: String(data), status: 'pending', createdAt: new Date().toISOString(), preferredDate: form.preferredDate || undefined })
      return true
    } catch (caught) {
      error.value = cellErrorMessage(caught, 'Não foi possível enviar o pedido de visita. Tente novamente.')
      return false
    } finally {
      sending.value = false
    }
  }

  async function cancelVisit(cellId: string, visitId: string): Promise<boolean> {
    const { $supabase } = useNuxtApp()
    if (!$supabase) return false
    sending.value = true
    error.value = ''
    try {
      const { error: rpcError } = await $supabase.rpc('update_cell_visit_request', { p_request_id: visitId, p_status: 'closed' })
      if (rpcError) throw rpcError
      const entry = entries.value.find(item => item.id === cellId)
      replaceVisit(cellId, entry?.myVisitRequest ? { ...entry.myVisitRequest, status: 'closed' } : undefined)
      return true
    } catch (caught) {
      error.value = cellErrorMessage(caught, 'Não foi possível cancelar o pedido. Tente novamente.')
      return false
    } finally {
      sending.value = false
    }
  }

  return { entries, loading, sending, error, demo, load, requestVisit, cancelVisit }
}
