import { useEffect, useRef, useState } from 'react';
import type { MatchView } from '../contracts/types';
import type { ConnectionStatus } from '../lib/useLiveRefresh';
import { useRerenderAt } from '../lib/useRerenderAt';
import { cueDuration, eventCue, shouldAnnounce, type TableCue } from './cue';

/** Aviso em exibição, com a revisão que o gerou (chave única: a mesma ação nunca anima duas vezes). */
export type ShownCue = TableCue & { revision: number };

interface Timed {
  cue: ShownCue;
  until: number;
}

const NO_MOMENTS: number[] = [];

/**
 * Aviso da mesa para a última ação confirmada pelo servidor ("SEIS!", "ACEITO!", "Corro!").
 *
 * - Só revisões novas vistas por este aparelho são anunciadas, uma vez cada (a revisão é a chave).
 * - Abrir a tela, remontar ou reconectar não repete aviso antigo (ver `shouldAnnounce`).
 * - Uma revisão nova substitui o aviso anterior na hora: a ordem é a do servidor.
 * - O tempo de exibição é só apresentação: nada no jogo espera por ele, e o fim vem de
 *   `useRerenderAt` (timer limpo ao desmontar), não de um timer solto num efeito.
 */
export function useTableCue(match: MatchView | null, connection: ConnectionStatus): ShownCue | null {
  const [shown, setShown] = useState<Timed | null>(null);
  const seenRevision = useRef<number | null>(null);
  const lostConnection = useRef(false);
  const revision = match?.revision;

  useEffect(() => {
    if (connection === 'reconnecting') lostConnection.current = true;
  }, [connection]);

  useEffect(() => {
    if (!match || revision === undefined) return;
    const previous = seenRevision.current;
    if (previous !== null && revision <= previous) return;
    seenRevision.current = revision;

    const announce = shouldAnnounce(previous, revision, lostConnection.current);
    lostConnection.current = false;
    const cue = announce ? eventCue(match.state.lastEvent, match.state) : null;
    setShown(cue ? { cue: { ...cue, revision }, until: Date.now() + cueDuration(cue) } : null);
    // Só a revisão decide: o estado público muda junto com ela.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision]);

  useRerenderAt(shown ? [shown.until] : NO_MOMENTS);
  return shown && Date.now() < shown.until ? shown.cue : null;
}
