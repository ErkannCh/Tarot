import { supabase } from './supabaseClient'

export type CreateSessionResult = {
  sessionId: string
  participants: Array<{ id: string; name: string }>
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export async function createSessionRemote(participants: string[]): Promise<CreateSessionResult | null> {
  const uid = await currentUserId()
  if (!uid) return null

  const { data: sessionInsert, error: sErr } = await supabase
    .from('sessions')
    .insert({ owner_id: uid })
    .select('id')
    .single()

  if (sErr || !sessionInsert) {
    console.warn('[Supabase] createSession failed', sErr)
    return null
  }

  const rows = participants.map((name) => ({ session_id: sessionInsert.id, name }))
  const { data: participantsInsert, error: pErr } = await supabase
    .from('session_participants')
    .insert(rows)
    .select('id, name')

  if (pErr || !participantsInsert) {
    console.warn('[Supabase] insert participants failed', pErr)
    return { sessionId: sessionInsert.id, participants: [] }
  }

  return { sessionId: sessionInsert.id, participants: participantsInsert }
}

export async function getParticipantsBySession(sessionId: string): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('session_participants')
    .select('id, name')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data
}

export async function addGameRemote(
  sessionId: string,
  details: unknown,
  scoresByName: Record<string, number>
): Promise<{ gameId: string } | null> {
  const uid = await currentUserId()
  if (!uid) return null

  // Insert game row
  const { data: gameInsert, error: gErr } = await supabase
    .from('games')
    .insert({ session_id: sessionId, details })
    .select('id')
    .single()

  if (gErr || !gameInsert) {
    console.warn('[Supabase] addGame failed', gErr)
    return null
  }

  // Map participant names to ids
  const participants = await getParticipantsBySession(sessionId)
  const nameToId = new Map(participants.map((p) => [p.name, p.id]))
  const scoreRows = Object.entries(scoresByName)
    .map(([name, score]) => {
      const pid = nameToId.get(name)
      if (!pid) return null
      return { game_id: gameInsert.id, participant_id: pid, score }
    })
    .filter(Boolean) as Array<{ game_id: string; participant_id: string; score: number }>

  if (scoreRows.length) {
    const { error: sErr } = await supabase.from('game_scores').insert(scoreRows)
    if (sErr) console.warn('[Supabase] addGame scores failed', sErr)
  }

  return { gameId: gameInsert.id }
}

export type RemoteSession = {
  id: string
  created_at: string
  participants: Array<{ id: string; name: string }>
}

export async function listSessionsRemote(): Promise<RemoteSession[]> {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, created_at, session_participants ( id, name )')
    .order('created_at', { ascending: false })
  if (error || !sessions) return []
  return sessions.map((s: any) => ({
    id: s.id,
    created_at: s.created_at,
    participants: (s.session_participants || []).map((p: any) => ({ id: p.id, name: p.name })),
  }))
}

export async function getSessionRemoteFull(sessionId: string): Promise<{
  id: string
  created_at: string
  participants: Array<{ id: string; name: string }>
  games: Array<{ id: string; created_at: string; details: any; scores: Array<{ participant_id: string; score: number }> }>
} | null> {
  const [{ data: part, error: pErr }, { data: games, error: gErr }, { data: sess, error: sErr }] = await Promise.all([
    supabase.from('session_participants').select('id, name').eq('session_id', sessionId).order('created_at', { ascending: true }),
    supabase.from('games').select('id, created_at, details, game_scores ( participant_id, score )').eq('session_id', sessionId).order('created_at', { ascending: true }),
    supabase.from('sessions').select('id, created_at').eq('id', sessionId).single(),
  ])

  if (pErr || gErr || sErr || !sess || !part || !games) return null

  return {
    id: sess.id,
    created_at: sess.created_at,
    participants: part,
    games: games.map((g: any) => ({ id: g.id, created_at: g.created_at, details: g.details, scores: g.game_scores || [] })),
  }
}

export async function renameParticipantsRemote(oldName: string, newName: string): Promise<number> {
  const { data, error } = await supabase
    .from('session_participants')
    .update({ name: newName })
    .eq('name', oldName)
    .select('id')
  if (error) {
    console.warn('[Supabase] rename participants failed', error)
    return 0
  }
  return data?.length ?? 0
}

export async function deleteSessionRemote(sessionId: string): Promise<boolean> {
  // Cascade deletes are ensured by FK ON DELETE CASCADE for participants/games/scores
  const { error } = await supabase.from('sessions').delete().eq('id', sessionId)
  if (error) {
    console.warn('[Supabase] delete session failed', error)
    return false
  }
  return true
}
