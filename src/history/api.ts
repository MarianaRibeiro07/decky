// Histórico: partidas jogadas (só leitura) e notas pessoais (CRUD com RLS por autor).
import type { MatchNote, MatchSummary, Team } from '../contracts/types';
import { supabase } from '../lib/supabase';

export async function fetchMyMatches(userId: string): Promise<MatchSummary[]> {
  // RLS já limita `matches` às partidas do usuário; o join traz a dupla dele.
  const { data, error } = await supabase
    .from('match_players')
    .select('team, matches(id, status, score_a, score_b, winner_team, started_at, ended_at)')
    .eq('user_id', userId);
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => ({
      id: row.matches.id,
      status: row.matches.status,
      scoreA: row.matches.score_a,
      scoreB: row.matches.score_b,
      winnerTeam: row.matches.winner_team as Team | null,
      myTeam: row.team as Team,
      startedAt: row.matches.started_at,
      endedAt: row.matches.ended_at,
    }))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

interface NoteRow {
  id: string;
  match_id: string;
  title: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

const toNote = (row: NoteRow): MatchNote => ({
  id: row.id,
  matchId: row.match_id,
  title: row.title,
  notes: row.notes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const NOTE_COLUMNS = 'id, match_id, title, notes, created_at, updated_at';

export async function listNotes(): Promise<MatchNote[]> {
  const { data, error } = await supabase.from('match_notes').select(NOTE_COLUMNS).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as NoteRow[]).map(toNote);
}

export async function getNote(id: string): Promise<MatchNote | null> {
  const { data, error } = await supabase.from('match_notes').select(NOTE_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toNote(data as NoteRow) : null;
}

export async function createNote(matchId: string, title: string, notes: string): Promise<MatchNote> {
  const { data, error } = await supabase
    .from('match_notes')
    .insert({ match_id: matchId, title: title.trim(), notes: notes.trim() })
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return toNote(data as NoteRow);
}

export async function updateNote(id: string, title: string, notes: string): Promise<MatchNote> {
  const { data, error } = await supabase
    .from('match_notes')
    .update({ title: title.trim(), notes: notes.trim() })
    .eq('id', id)
    .select(NOTE_COLUMNS)
    .single();
  if (error) throw error;
  return toNote(data as NoteRow);
}

export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('match_notes').delete().eq('id', id);
  if (error) throw error;
}

export function validateNoteTitle(title: string): string | null {
  const length = title.trim().length;
  if (length === 0) return 'Dê um título para a nota.';
  if (length > 80) return 'Use no máximo 80 caracteres.';
  return null;
}
