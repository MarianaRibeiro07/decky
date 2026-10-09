import { useEffect, useRef } from 'react';
import type { ActionDeadline, Seat } from '../contracts/types';
import { expireDelay } from './deadline';

/**
 * Um único timer por prazo: quando ele vence, pede ao servidor a expiração (`fire`). O servidor confere
 * no relógio dele e aplica a regra; este aparelho só avisa. Prazo novo, troca de lugar ou desmontar
 * limpam o timer. `seat` null (a mesa central) não pede: ela não joga.
 */
export function useDeadlineExpiry(
  deadline: ActionDeadline | null | undefined,
  seat: Seat | null,
  offset: number,
  fire: (deadline: ActionDeadline) => void,
): void {
  const fireRef = useRef(fire);
  fireRef.current = fire;
  const deadlineRef = useRef(deadline);
  deadlineRef.current = deadline;
  const at = deadline?.at ?? null;

  useEffect(() => {
    const current = deadlineRef.current;
    if (at === null || !current || seat === null) return;
    const timer = setTimeout(() => fireRef.current(current), expireDelay(current, Date.now(), offset, seat));
    return () => clearTimeout(timer);
  }, [at, seat, offset]);
}
