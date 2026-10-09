// Prazos das decisões (D-25 a D-28) e a carta usada quando o prazo de jogar vence.
// Puro: o relógio (`now`, epoch ms do Postgres) é sempre recebido, nunca lido aqui.
import { otherTeam } from './cards.ts';
import { cardStrength } from './strength.ts';
import type { ActionDeadline, Card, PublicGameState, Rank, Seat, Team } from './types.ts';

/** Tempo de cada decisão: jogar carta e responder truco/aumento. */
export const ACTION_TIMEOUT_MS = 20_000;

/** Folga na mão nova: a distribuição animada leva cerca de 3 s e ninguém joga antes de ver as cartas. */
export const HAND_START_GRACE_MS = 3_500;

/** Carta de menor força da mão (D-26); empate fica com a primeira na ordem da mão. null com mão vazia. */
export function weakestCard(hand: readonly Card[], manilhaRank: Rank): Card | null {
  let weakest: Card | null = null;
  for (const card of hand) {
    if (weakest === null || cardStrength(card, manilhaRank) < cardStrength(weakest, manilhaRank)) weakest = card;
  }
  return weakest;
}

function open(kind: ActionDeadline['kind'], startsAt: number, seat: Seat | null, team: Team | null): ActionDeadline {
  return { kind, startsAt, at: startsAt + ACTION_TIMEOUT_MS, seat, team };
}

/**
 * Prazo depois de uma ação, comparando o estado de antes (`prev`, null na partida nova) com o de agora.
 * - Truco pendente: prazo para a dupla que responde; o mesmo pedido (inclusive com a dupla decidindo)
 *   mantém o prazo.
 * - Sem truco: prazo para quem tem a vez. Mesma vez com a mesa igual (pedido da dupla aberto, recusado
 *   ou desistido) mantém o prazo: o pedido não reinicia a contagem. Aceitar um truco reinicia.
 * - Mão nova começa depois da folga da distribuição.
 */
export function deadlineFor(prev: PublicGameState | null, next: PublicGameState, now: number): ActionDeadline | null {
  if (next.status !== 'playing') return null;
  const kept = prev?.deadline ?? null;
  const sameHand = prev !== null && prev.handNumber === next.handNumber;

  if (next.truco) {
    const sameRequest =
      sameHand &&
      prev!.truco !== null &&
      prev!.truco.value === next.truco.value &&
      prev!.truco.requestedBySeat === next.truco.requestedBySeat;
    if (sameRequest && kept?.kind === 'truco') return kept;
    return open('truco', now, null, otherTeam(next.truco.requestedBy));
  }

  const sameTurn =
    sameHand &&
    prev!.truco === null &&
    kept?.kind === 'play' &&
    kept.seat === next.currentTurnSeat &&
    prev!.tableCards.length === next.tableCards.length &&
    prev!.trickResults.length === next.trickResults.length;
  if (sameTurn) return kept;

  return open('play', sameHand ? now : now + HAND_START_GRACE_MS, next.currentTurnSeat, null);
}
