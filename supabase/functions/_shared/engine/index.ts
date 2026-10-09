// Fachada do motor. Sem I/O: a Edge Function lê o estado, chama applyAction e grava o resultado.
export * from './types.ts';
export { RANKS, SUITS, SEATS, createDeck, cryptoRng, deal, nextSeat, otherTeam, sameCard, seededRng, shuffle, teamOf } from './cards.ts';
export { cardStrength, manilhaRankFor, resolveTrick } from './strength.ts';
export { handOutcome } from './hand.ts';
export { WINNING_SCORE, applyAction, getLegalActions, newMatch, startHand, teamDecisionFor } from './game.ts';
export type { LegalActions } from './game.ts';
