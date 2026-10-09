import { useCallback, useRef, useState } from 'react';
import type { MatchPlayer, PrivateHand } from '../contracts/types';
import { useLiveRefresh } from '../lib/useLiveRefresh';
import { fetchMatch, fetchMatchPlayers, fetchMyHand } from './api';
import { EMPTY_MATCH_DATA, mergeMatchData, type MatchData } from './matchData';

export type { MatchData };

/**
 * Estado público da partida (Realtime em `matches`) e, para jogadores, a própria mão (get_my_hand).
 * A mão nunca chega por Realtime: é buscada sempre que a revisão muda. A mesa central nunca recebe mão;
 * o servidor devolve null para quem não é jogador, e este hook nem chega a pedir.
 */
export function useMatch(matchId: string | undefined, userId: string | null) {
  const [data, setData] = useState<MatchData>(EMPTY_MATCH_DATA);
  const handRevision = useRef<number | null>(null);
  const playersCache = useRef<MatchPlayer[] | null>(null);

  const refresh = useCallback(async () => {
    if (!matchId) return;
    const match = await fetchMatch(matchId);
    if (!match) {
      setData((d) => (d.loaded && d.notFound ? d : { ...d, loaded: true, notFound: true }));
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

    // Leitura igual à anterior (polling, Realtime repetido) não redesenha a partida.
    setData((d) => mergeMatchData(d, { match, players, hand }, userId));
  }, [matchId, userId]);

  const { status, refreshNow } = useLiveRefresh(
    matchId ? `match:${matchId}` : null,
    matchId ? [{ table: 'matches', filter: `id=eq.${matchId}` }] : [],
    refresh,
  );

  return { ...data, connection: status, refresh: refreshNow };
}
