import { useCallback, useState } from 'react';
import type { Room, RoomSeat } from '../contracts/types';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { fetchActiveMatchId, fetchRoomByCode, fetchSeats } from './api';

export interface RoomState {
  room: Room | null;
  seats: RoomSeat[];
  activeMatchId: string | null;
  /** true quando a sala não existe mais ou o usuário saiu dela. */
  gone: boolean;
  loaded: boolean;
}

/** Mesma sala, mesmos lugares e mesma partida (os objetos vêm novos a cada leitura). */
export function sameRoomState(a: RoomState, b: RoomState): boolean {
  return (
    a.loaded === b.loaded &&
    a.gone === b.gone &&
    a.activeMatchId === b.activeMatchId &&
    JSON.stringify(a.room) === JSON.stringify(b.room) &&
    JSON.stringify(a.seats) === JSON.stringify(b.seats)
  );
}

/** Lobby em tempo real: sala, posições e partida em andamento. */
export function useRoom(code: string | undefined) {
  const [state, setState] = useState<RoomState>({ room: null, seats: [], activeMatchId: null, gone: false, loaded: false });

  const refresh = useCallback(async () => {
    if (!code) return;
    const room = await fetchRoomByCode(code);
    if (!room) {
      setState((s) => ({ ...s, room: null, seats: [], gone: true, loaded: true }));
      return;
    }
    const [seats, activeMatchId] = await Promise.all([
      fetchSeats(room.id),
      room.status === 'playing' ? fetchActiveMatchId(room.id) : Promise.resolve(null),
    ]);
    const next: RoomState = { room, seats, activeMatchId, gone: false, loaded: true };
    // Polling a cada 3 s quase sempre traz a mesma sala: sem mudança, mantém o objeto e o lobby não redesenha.
    setState((prev) => (sameRoomState(prev, next) ? prev : next));
  }, [code]);

  const roomId = state.room?.id;
  const { status, refreshNow } = useLiveRefresh(
    code ? `room:${code}` : null,
    roomId
      ? [
          { table: 'rooms', filter: `id=eq.${roomId}` },
          { table: 'room_players', filter: `room_id=eq.${roomId}` },
          { table: 'matches', filter: `room_id=eq.${roomId}` },
        ]
      : [],
    refresh,
    3000,
  );

  return { ...state, connection: status, refresh: refreshNow };
}
