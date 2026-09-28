import type { CellDetailsFormValue, CellLeaderProfileFormValue } from '~/types/cells'
import type {
  CellAnnouncement,
  CellDetail,
  CellInvitation,
  CellMember,
  CellPoll,
  CellSummary
} from '~/types/domain'
import { cellDetailsRpcArgs } from '~/utils/cellAddress'
import { cellErrorMessage, mapDirectoryRows } from '~/utils/cellDirectory'
import { aggregatePollVotes, DEMO_CELLS, normalizeInvitationEmail, resolveCellAccess } from '~/utils/cells'
import { demoCellDetail } from '~/utils/cellsDemo'

interface CellRow {
  community_id: string
  meeting_weekday: number | null
  meeting_time: string | null
  active: boolean
  community: { name: string, description: string | null } | Array<{ name: string, description: string | null }> | null
}

interface MembershipRow { community_id: string, user_id: string, status: string }
interface LeaderRow { cell_id: string, user_id: string }
interface InvitationRow { id: string, cell_id: string, invitee_email: string, status: CellInvitation['status'], created_at: string }
interface AnnouncementRow { id: string, cell_id: string, title: string, body: string, status: CellAnnouncement['status'], created_at: string }
interface PollRow { id: string, cell_id: string, question: string, status: CellPoll['status'], created_at: string }
interface PollOptionRow { id: string, poll_id: string, label: string, position: number }
interface VoteRow { poll_id: string, option_id: string, user_id: string }
interface ProfileRow { id: string, full_name: string, email: string }

function one<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? value[0] || null : value
}

export const useCellsStore = defineStore('cells', () => {
  const auth = useAuthStore()
  const cells = ref<CellSummary[]>([])
  const selected = ref<CellDetail | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const demoMode = ref(false)
  const errorMessage = ref('')

  function backend() {
    const { $supabase } = useNuxtApp()
    if (!$supabase || !auth.profile || demoMode.value) throw new Error('Esta ação exige uma sessão real conectada ao Supabase.')
    return $supabase
  }

  async function loadCells() {
    loading.value = true
    errorMessage.value = ''
    try {
      const { $supabase } = useNuxtApp()
      if (!$supabase) {
        demoMode.value = true
        cells.value = DEMO_CELLS
        return
      }
      demoMode.value = false
      if (!auth.profile) {
        cells.value = []
        return
      }

      const [cellResult, membershipResult, leaderResult, invitationResult] = await Promise.all([
        $supabase.from('cells').select('community_id, meeting_weekday, meeting_time, active, community:communities!cells_community_id_fkey(name, description)').order('created_at'),
        $supabase.from('community_memberships').select('community_id, user_id, status').eq('user_id', auth.profile.id),
        $supabase.from('cell_leaders').select('cell_id, user_id').eq('user_id', auth.profile.id),
        $supabase.from('cell_invitations').select('id, cell_id, invitee_email, status, created_at').eq('status', 'pending')
      ])
      const failure = cellResult.error || membershipResult.error || leaderResult.error || invitationResult.error
      if (failure) throw failure

      const memberships = new Map((membershipResult.data as MembershipRow[]).map(item => [item.community_id, item.status]))
      const leaderships = new Set((leaderResult.data as LeaderRow[]).map(item => item.cell_id))
      const invitations = new Map((invitationResult.data as InvitationRow[]).map(item => [item.cell_id, item]))
      cells.value = (cellResult.data as CellRow[]).flatMap((row) => {
        const community = one(row.community)
        const invitation = invitations.get(row.community_id)
        const access = resolveCellAccess(auth.profile, leaderships.has(row.community_id), memberships.get(row.community_id), Boolean(invitation))
        if (!community || !access) return []
        return [{
          id: row.community_id,
          name: community.name,
          description: community.description || undefined,
          meetingWeekday: row.meeting_weekday ?? undefined,
          meetingTime: row.meeting_time || undefined,
          access,
          active: row.active,
          pendingInvitationId: invitation?.id
        } satisfies CellSummary]
      })
    } catch (error) {
      errorMessage.value = cellErrorMessage(error, 'Não foi possível carregar as células.')
      cells.value = []
    } finally {
      loading.value = false
    }
  }

  async function loadCell(cellId: string) {
    loading.value = true
    errorMessage.value = ''
    try {
      if (!cells.value.length) await loadCells()
      const summary = cells.value.find(cell => cell.id === cellId)
      if (!summary) {
        selected.value = null
        errorMessage.value = 'Esta célula não existe ou você não possui acesso.'
        return
      }
      if (demoMode.value) {
        selected.value = demoCellDetail(summary)
        return
      }

      const supabase = backend()
      const managerView = summary.access === 'manager' || summary.access === 'leader'
      const [addressResult, announcementResult, pollResult, membershipResult, invitationResult, leaderResult, settingsResult, directoryResult] = await Promise.all([
        supabase.from('cell_addresses').select('address_line, neighborhood, city, region, postal_code').eq('cell_id', cellId).maybeSingle(),
        supabase.from('cell_announcements').select('id, cell_id, title, body, status, created_at').eq('cell_id', cellId).order('created_at', { ascending: false }),
        supabase.from('cell_polls').select('id, cell_id, question, status, created_at').eq('cell_id', cellId).order('created_at', { ascending: false }),
        managerView ? supabase.from('community_memberships').select('community_id, user_id, status').eq('community_id', cellId).eq('status', 'approved') : Promise.resolve({ data: [], error: null }),
        supabase.from('cell_invitations').select('id, cell_id, invitee_email, status, created_at').eq('cell_id', cellId).order('created_at', { ascending: false }),
        managerView ? supabase.from('cell_leaders').select('cell_id, user_id').eq('cell_id', cellId) : Promise.resolve({ data: [], error: null }),
        supabase.from('cells').select('show_full_address_to_members').eq('community_id', cellId).maybeSingle(),
        supabase.rpc('list_cell_directory', { p_cell_id: cellId })
      ])
      const failure = addressResult.error || announcementResult.error || pollResult.error || membershipResult.error || invitationResult.error || leaderResult.error || settingsResult.error || directoryResult.error
      if (failure) throw failure

      const memberships = membershipResult.data as MembershipRow[]
      const leaders = mapDirectoryRows(directoryResult.data)[0]?.leaders ?? []
      const leaderIds = new Set([...(leaderResult.data as LeaderRow[]).map(item => item.user_id), ...leaders.map(leader => leader.userId)])
      let members: CellMember[] = []
      if (memberships.length) {
        const profileResult = await supabase.from('profiles').select('id, full_name, email').in('id', memberships.map(item => item.user_id))
        if (profileResult.error) throw profileResult.error
        members = (profileResult.data as ProfileRow[]).map(profile => ({
          userId: profile.id,
          name: profile.full_name,
          email: profile.email,
          isLeader: leaderIds.has(profile.id)
        }))
      }

      const polls = pollResult.data as PollRow[]
      const pollIds = polls.map(poll => poll.id)
      let options: PollOptionRow[] = []
      let votes: VoteRow[] = []
      if (pollIds.length) {
        const [optionResult, voteResult] = await Promise.all([
          supabase.from('cell_poll_options').select('id, poll_id, label, position').in('poll_id', pollIds).order('position'),
          supabase.from('cell_poll_votes').select('poll_id, option_id, user_id').in('poll_id', pollIds)
        ])
        if (optionResult.error || voteResult.error) throw optionResult.error || voteResult.error
        options = optionResult.data as PollOptionRow[]
        votes = voteResult.data as VoteRow[]
      }

      const address = addressResult.data
      selected.value = {
        ...summary,
        showFullAddress: settingsResult.data?.show_full_address_to_members !== false,
        leaders,
        address: address
          ? {
              addressLine: address.address_line,
              neighborhood: address.neighborhood || undefined,
              city: address.city,
              region: address.region,
              postalCode: address.postal_code || undefined
            }
          : undefined,
        members,
        invitations: (invitationResult.data as InvitationRow[]).map(invitation => ({
          id: invitation.id,
          cellId: invitation.cell_id,
          email: invitation.invitee_email,
          status: invitation.status,
          createdAt: invitation.created_at
        })),
        announcements: (announcementResult.data as AnnouncementRow[]).map(announcement => ({
          id: announcement.id,
          cellId: announcement.cell_id,
          title: announcement.title,
          body: announcement.body,
          status: announcement.status,
          createdAt: announcement.created_at
        })),
        polls: polls.map((poll) => {
          const pollOptions = options.filter(option => option.poll_id === poll.id).map(option => ({ id: option.id, label: option.label, position: option.position }))
          const pollVotes = votes.filter(vote => vote.poll_id === poll.id)
          return {
            id: poll.id,
            cellId: poll.cell_id,
            question: poll.question,
            status: poll.status,
            createdAt: poll.created_at,
            options: aggregatePollVotes(pollOptions, pollVotes.map(vote => vote.option_id)),
            selectedOptionId: pollVotes.find(vote => vote.user_id === auth.profile?.id)?.option_id
          }
        })
      }
    } catch (error) {
      selected.value = null
      errorMessage.value = cellErrorMessage(error, 'Não foi possível carregar esta célula.')
    } finally {
      loading.value = false
    }
  }

  async function withSave(action: () => Promise<void>, cellId?: string) {
    saving.value = true
    errorMessage.value = ''
    try {
      await action()
      await loadCells()
      if (cellId) await loadCell(cellId)
    } catch (error) {
      errorMessage.value = cellErrorMessage(error, 'Não foi possível salvar a alteração.')
      throw error
    } finally {
      saving.value = false
    }
  }

  async function createCell(input: { details: CellDetailsFormValue, leaderEmails: string[] }) {
    return withSave(async () => {
      const supabase = backend()
      const emails = [...new Set(input.leaderEmails.map(normalizeInvitationEmail).filter(Boolean))]
      if (!emails.length) throw new Error('Informe o e-mail de pelo menos um líder.')
      const profileResult = await supabase.from('profiles').select('id, email_normalized').in('email_normalized', emails)
      if (profileResult.error) throw profileResult.error
      if (profileResult.data.length !== emails.length) throw new Error('Todos os líderes precisam ter cadastro ativo no CEDA.')
      const result = await supabase.rpc('create_cell_with_details', {
        ...cellDetailsRpcArgs(input.details),
        p_leader_ids: profileResult.data.map(profile => profile.id)
      })
      if (result.error) throw result.error
    })
  }

  async function respondInvitation(invitationId: string, cellId: string, accepted: boolean) {
    return withSave(async () => {
      const result = await backend().from('cell_invitations').update({ status: accepted ? 'accepted' : 'declined' }).eq('id', invitationId)
      if (result.error) throw result.error
    }, cellId)
  }

  async function saveDetails(cellId: string, details: CellDetailsFormValue) {
    return withSave(async () => {
      const result = await backend().rpc('update_cell_details', { p_cell_id: cellId, ...cellDetailsRpcArgs(details), p_active: details.active })
      if (result.error) throw result.error
    }, cellId)
  }

  async function saveLeaderProfile(cellId: string, userId: string, profile: CellLeaderProfileFormValue) {
    return withSave(async () => {
      const result = await backend().rpc('update_cell_leader_profile', {
        p_cell_id: cellId,
        p_user_id: userId,
        p_bio: profile.bio.trim() || null,
        p_whatsapp: profile.whatsapp.trim() || null,
        p_instagram: profile.instagram.trim() || null
      })
      if (result.error) throw result.error
    }, cellId)
  }

  async function inviteMember(cellId: string, email: string) {
    return withSave(async () => {
      const result = await backend().from('cell_invitations').insert({ cell_id: cellId, invitee_email: normalizeInvitationEmail(email), invited_by: auth.profile?.id })
      if (result.error) throw result.error
    }, cellId)
  }

  async function addMember(cellId: string, userId: string) {
    return withSave(async () => {
      const result = await backend().rpc('add_cell_member', { p_cell_id: cellId, p_user_id: userId })
      if (result.error) throw result.error
    }, cellId)
  }

  async function removeMember(cellId: string, userId: string) {
    return withSave(async () => {
      const result = await backend().rpc('remove_cell_member', { p_cell_id: cellId, p_user_id: userId })
      if (result.error) throw result.error
    }, cellId)
  }

  async function assignLeader(cellId: string, email: string) {
    return withSave(async () => {
      const supabase = backend()
      const profileResult = await supabase.from('profiles').select('id').eq('email_normalized', normalizeInvitationEmail(email)).maybeSingle()
      if (profileResult.error) throw profileResult.error
      if (!profileResult.data) throw new Error('Usuário cadastrado não encontrado.')
      const membershipResult = await supabase.from('community_memberships').upsert({ community_id: cellId, user_id: profileResult.data.id, status: 'approved', role: 'member', invited_by: auth.profile?.id, reviewed_by: auth.profile?.id, reviewed_at: new Date().toISOString() })
      if (membershipResult.error) throw membershipResult.error
      const leaderResult = await supabase.from('cell_leaders').insert({ cell_id: cellId, user_id: profileResult.data.id, assigned_by: auth.profile?.id })
      if (leaderResult.error) throw leaderResult.error
    }, cellId)
  }

  async function removeLeader(cellId: string, userId: string) {
    return withSave(async () => {
      const result = await backend().from('cell_leaders').delete().eq('cell_id', cellId).eq('user_id', userId)
      if (result.error) throw result.error
    }, cellId)
  }

  async function createAnnouncement(cellId: string, title: string, body: string) {
    return withSave(async () => {
      const result = await backend().from('cell_announcements').insert({ cell_id: cellId, title, body, created_by: auth.profile?.id })
      if (result.error) throw result.error
    }, cellId)
  }

  async function setAnnouncementStatus(cellId: string, announcementId: string, status: 'published' | 'archived') {
    return withSave(async () => {
      const result = await backend().from('cell_announcements').update({ status }).eq('id', announcementId)
      if (result.error) throw result.error
    }, cellId)
  }

  async function createPoll(cellId: string, question: string, optionLabels: string[]) {
    return withSave(async () => {
      const supabase = backend()
      const options = optionLabels
        .map(label => label.trim())
        .filter(Boolean)
        .map((label, position) => ({ label, position }))
      if (options.length < 2) throw new Error('Informe pelo menos duas opções.')
      const pollResult = await supabase.from('cell_polls').insert({ cell_id: cellId, question, created_by: auth.profile?.id }).select('id').single()
      if (pollResult.error) throw pollResult.error
      const optionResult = await supabase.from('cell_poll_options').insert(options.map(option => ({ ...option, poll_id: pollResult.data.id })))
      if (optionResult.error) throw optionResult.error
    }, cellId)
  }

  async function setPollStatus(cellId: string, pollId: string, status: 'published' | 'closed') {
    return withSave(async () => {
      const result = await backend().from('cell_polls').update({ status }).eq('id', pollId)
      if (result.error) throw result.error
    }, cellId)
  }

  async function vote(cellId: string, pollId: string, optionId: string) {
    return withSave(async () => {
      const result = await backend().from('cell_poll_votes').insert({ poll_id: pollId, option_id: optionId, user_id: auth.profile?.id })
      if (result.error) throw result.error
    }, cellId)
  }

  return {
    cells,
    selected,
    loading,
    saving,
    demoMode,
    errorMessage,
    loadCells,
    loadCell,
    createCell,
    respondInvitation,
    saveDetails,
    saveLeaderProfile,
    inviteMember,
    addMember,
    removeMember,
    assignLeader,
    removeLeader,
    createAnnouncement,
    setAnnouncementStatus,
    createPoll,
    setPollStatus,
    vote
  }
})
