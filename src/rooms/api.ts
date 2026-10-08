// Salas: toda escrita passa por RPC no servidor; aqui só chamadas e leituras.
import type { Room, RoomSeat, Seat, Team } from '../contracts/types';
import { supabase } from '../lib/supabase';

interface RoomRow {
  id: string;
  code: string;
  host_user_id: string;
  status: Room['status'];
}

const toRoom = (row: RoomRow): Room => ({
  id: row.id,
  code: row.code,
  hostUserId: row.host_user_id,
  status: row.status,
});

export async function createRoom(): Promise<Room> {
  const { data, error } = await supabase.rpc('create_room');
  if (error) throw error;
  return toRoom(data as RoomRow);
}

export async function joinRoom(code: string): Promise<Room> {
  const { data, error } = await supabase.rpc('join_room', { p_code: code });
  if (error) throw error;
  return toRoom(data as RoomRow);
}

export async function changeSeat(roomId: string, seat: Seat): Promise<void> {
  const { error } = await supabase.rpc('change_seat', { p_room_id: roomId, p_seat: seat });
  if (error) throw error;
}

export async function setReady(roomId: string, ready: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_ready', { p_room_id: roomId, p_ready: ready });
  if (error) throw error;
}

export async function leaveRoom(roomId: string): Promise<void> {
  const { error } = await supabase.rpc('leave_room', { p_room_id: roomId });
  if (error) throw error;
}

export async function fetchRoomByCode(code: string): Promise<Room | null> {
  const { data, error } = await supabase.from('rooms').select('id, code, host_user_id, status').eq('code', code).maybeSingle();
  if (error) throw error;
  return data ? toRoom(data as RoomRow) : null;
}

export async function fetchSeats(roomId: string): Promise<RoomSeat[]> {
  const { data, error } = await supabase
    .from('room_players')
    .select('seat, team, ready, user_id, profiles(display_name)')
    .eq('room_id', roomId)
    .order('seat');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    seat: row.seat as Seat,
    team: row.team as Team,
    ready: row.ready,
    userId: row.user_id,
    displayName: row.profiles?.display_name ?? 'Jogador',
  }));
}

/** Partida em andamento da sala, se houver (para levar o lobby direto à mesa). */
export async function fetchActiveMatchId(roomId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('matches')
    .select('id')
    .eq('room_id', roomId)
    .eq('status', 'playing')
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
