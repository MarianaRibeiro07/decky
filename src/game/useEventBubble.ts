import { useEffect, useRef, useState } from 'react';
import type { MatchView, Seat } from '../contracts/types';
import { eventBubble } from './describe';

const BUBBLE_MS = 3500;

/**
 * Fala curta ("TRUCO!", "Aceito!", "Corro!") junto de quem acabou de agir, por alguns segundos.
 * Só aparece para revisões novas vistas por este aparelho: abrir ou reconectar não repete falas antigas.
 */
export function useEventBubble(match: MatchView | null): { seat: Seat; text: string } | null {
  const [bubble, setBubble] = useState<{ seat: Seat; text: string } | null>(null);
  const seenRevision = useRef<number | null>(null);
  const revision = match?.revision;

  useEffect(() => {
    if (!match || revision === undefined) return;
    const first = seenRevision.current === null;
    if (!first && revision <= seenRevision.current!) return;
    seenRevision.current = revision;
    if (first) return;

    const event = match.state.lastEvent;
    const text = eventBubble(event, match.state);
    if (!event || !text) {
      setBubble(null);
      return;
    }
    setBubble({ seat: event.seat, text });
    const timer = setTimeout(() => setBubble(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [revision]);

  return bubble;
}
