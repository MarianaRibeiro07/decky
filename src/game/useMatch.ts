import { useCallback, useRef, useState } from 'react';
import type { MatchPlayer, MatchView, PrivateHand } from '../contracts/types';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { fetchMatch, fetchMatchPlayers, fetchMyHand } from './api';

export interface MatchData {
  match: MatchView | null;
  hand: PrivateHand | null;
  players: MatchPlayer[];
  loaded: boolean;
  /** true quando a partida não existe ou o usuário não é jogador dela. */
  notFound: boolean;
}

/**
 * Estado público da partida (Realtime em `matches`) e a própria mão (get_my_hand).
 * A mão nunca chega por Realtime: é buscada sempre que a revisão muda.
 */
export function useMatch(matchId: string | undefined) {
  const [data, setData] = useState<MatchData>({ match: null, hand: null, players: [], loaded: false, notFound: false });
  const handRevision = useRef<number | null>(null);
  const playersLoaded = useRef(false);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const match = await fetchMatch(matchId);
    if (!match) {
      setData((d) => ({ ...d, loaded: true, notFound: true }));
      return;
    }

    let hand: PrivateHand | null | undefined;
    if (handRevision.current !== match.revision) {
      hand = await fetchMyHand(matchId);
      handRevision.current = hand?.revision ?? null;
    }

    let players: MatchPlayer[] | undefined;
    if (!playersLoaded.current) {
      players = await fetchMatchPlayers(matchId);
      playersLoaded.current = true;
    }

    setData((d) => ({
      match: d.match && d.match.revision > match.revision ? d.match : match,
      hand: hand === undefined ? d.hand : hand,
      players: players ?? d.players,
      loaded: true,
      notFound: false,
    }));
  }, [matchId]);

  const { status, refreshNow } = useLiveRefresh(
    matchId ? `match:${matchId}` : null,
    matchId ? [{ table: 'matches', filter: `id=eq.${matchId}` }] : [],
    refresh,
  );

  return { ...data, connection: status, refresh: refreshNow };
}
