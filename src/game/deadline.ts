// Contagem do prazo no aparelho. Puro, para ser testado sem React Native.
// O prazo é absoluto, no relógio do servidor; o aparelho só converte com a diferença de relógio
// (`offset` = servidor - aparelho). Quem decide o que acontece no fim é sempre o servidor.
import { teamOf } from '../../supabase/functions/_shared/engine/cards.ts';
import { ACTION_TIMEOUT_MS } from '../../supabase/functions/_shared/engine/turns.ts';
import type { ActionDeadline, Seat } from '../contracts/types';

export { ACTION_TIMEOUT_MS };

/** Últimos segundos, destacados em vermelho. */
export const URGENT_MS = 5_000;

/** Espera depois do fim antes de pedir a expiração, e o intervalo entre um lugar e o seguinte. */
export const EXPIRE_GRACE_MS = 300;
export const EXPIRE_STAGGER_MS = 700;

const serverTime = (localNow: number, offset: number) => localNow + offset;

/** A contagem já começou? (Na mão nova ela começa depois da folga da distribuição.) */
export function hasStarted(deadline: ActionDeadline, localNow: number, offset: number): boolean {
  return serverTime(localNow, offset) >= deadline.startsAt;
}

/** Tempo restante em ms, entre 0 e 20 s. */
export function remainingMs(deadline: ActionDeadline, localNow: number, offset: number): number {
  return Math.max(0, Math.min(ACTION_TIMEOUT_MS, deadline.at - serverTime(localNow, offset)));
}

/** Segundos mostrados: 20 até faltar 19 s, e 0 só quando acabou. */
export const secondsLeft = (remaining: number) => Math.ceil(remaining / 1000);

/**
 * Instantes (no relógio do aparelho) em que o número muda, mais o início da contagem.
 * Com `useRerenderAt`, o componente do prazo redesenha uma vez por segundo, e só ele.
 */
export function tickMoments(deadline: ActionDeadline, offset: number): number[] {
  const moments = [deadline.startsAt - offset];
  for (let s = ACTION_TIMEOUT_MS / 1000 - 1; s >= 0; s--) moments.push(deadline.at - s * 1000 - offset);
  return moments;
}

/** O prazo é de quem olha? Jogar: o próprio lugar. Truco: a própria dupla responde. */
export function isMine(deadline: ActionDeadline, seat: Seat): boolean {
  return deadline.kind === 'play' ? deadline.seat === seat : deadline.team === teamOf(seat);
}

/**
 * Daqui a quanto tempo (ms) este aparelho pede a expiração. O lugar 1 tenta primeiro e os outros
 * esperam um pouco mais: normalmente só um pedido chega, e os outros recebem `conflict` ou `too_early`.
 */
export function expireDelay(deadline: ActionDeadline, localNow: number, offset: number, seat: Seat): number {
  const fireAt = deadline.at + EXPIRE_GRACE_MS + (seat - 1) * EXPIRE_STAGGER_MS;
  return Math.max(0, fireAt - serverTime(localNow, offset));
}

/** Identidade do pedido de expiração: o reenvio do mesmo aparelho para o mesmo prazo não duplica. */
export const expireActionId = (deadline: ActionDeadline, seat: Seat) => `expire-${deadline.at}-${seat}`;

/**
 * Diferença entre o relógio do servidor e o do aparelho, a partir de uma leitura de server_now
 * enviada em `sentAt` e recebida em `receivedAt` (metade da ida e volta para cada lado).
 */
export function clockOffset(sentAt: number, receivedAt: number, serverNow: number): number {
  return serverNow - (sentAt + (receivedAt - sentAt) / 2);
}
