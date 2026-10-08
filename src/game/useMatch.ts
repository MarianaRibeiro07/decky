import { useCallback, useRef, useState } from 'react';
import type { MatchPlayer, MatchRole, MatchView, PrivateHand } from '../contracts/types';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { fetchMatch, fetchMatchPlayers, fetchMyHand } from './api';
import { resolveRole } from './role';

export interface MatchData {
  match: MatchView | null;
  hand: PrivateHand | null;
  players: MatchPlayer[];
  /** Jogador (tem mão) ou mesa central (só estado público). null antes de carregar. */
  role: MatchRole | null;
  loaded: boolean;
  /** true quando a partida não existe ou o usuário não pode vê-la. */
  notFound: boolean;
}

/**
 * Estado público da partida (Realtime em `matches`) e, para jogadores, a própria mão (get_my_hand).
 * A mão nunca chega por Realtime: é buscada sempre que a revisão muda. A mesa central nunca recebe mão;
 * o servidor devolve null para quem não é jogador.
 */
export function useMatch(matchId: string | undefined, userId: string | null) {
  const [data, setData] = useState<MatchData>({
    match: null,
    hand: null,
    players: [],
    role: null,
    loaded: false,
    notFound: false,
  });
  const handRevision = useRef<number | null>(null);
  const playersCache = useRef<MatchPlayer[] | null>(null);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const match = await fetchMatch(matchId);
    if (!match) {
      setData((d) => ({ ...d, loaded: true, notFound: true }));
      return;
    }

    if (!playersCache.current) playersCache.current = await fetchMatchPlayers(matchId);
    const players = playersCache.current;
    const isPlayer = players.some((p) => p.userId === userId);

    let hand: PrivateHand | null | undefined;
    if (isPlayer && handRevision.current !== match.revision) {
      hand = await fetchMyHand(matchId);
      handRevision.current = hand?.revision ?? null;
    }

    setData((d) => {
      const nextHand = hand === undefined ? d.hand : hand;
      const role = resolveRole(userId, match, players, nextHand);
      return {
        // Leituras podem chegar fora de ordem: nunca volta para uma revisão mais antiga.
        match: d.match && d.match.revision > match.revision ? d.match : match,
        hand: nextHand,
        players,
        role,
        loaded: true,
        notFound: role === null,
      };
    });
  }, [matchId, userId]);

  const { status, refreshNow } = useLiveRefresh(
    matchId ? `match:${matchId}` : null,
    matchId ? [{ table: 'matches', filter: `id=eq.${matchId}` }] : [],
    refresh,
  );

  return { ...data, connection: status, refresh: refreshNow };
}
