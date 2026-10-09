// Gesto de jogada automática (arrastar a carta para cima). Puro, para ser testado sem React Native.
// A regra (quando a carta é jogada, se ainda vale) é do servidor; aqui só o que o dedo precisa fazer.
import type { LegalActions } from '../../supabase/functions/_shared/engine/game.ts';
import type { PublicGameState } from '../contracts/types';

/** Distância mínima, em pt, para telas e cartas muito pequenas. */
export const AUTO_DRAG_MIN = 56;

/** Quanto subir para marcar: 60% da altura da carta, para valer igual em qualquer tamanho de mão. */
export function autoDragThreshold(cardHeight: number): number {
  return Math.max(AUTO_DRAG_MIN, cardHeight * 0.6);
}

/**
 * O gesto só começa com movimento claramente vertical para cima. Toque simples continua selecionando
 * e arrastar de lado não é capturado.
 */
export function startsAutoDrag(dx: number, dy: number): boolean {
  return dy < -10 && Math.abs(dy) > Math.abs(dx) * 1.5;
}

/**
 * Dá para marcar agora? Fora da própria vez com jogada livre (aí vale a jogada normal, D-23),
 * fora da distribuição e com a partida em andamento.
 */
export function canArmAuto(state: PublicGameState, legal: LegalActions, dealing: boolean): boolean {
  return state.status === 'playing' && !dealing && !legal.playCard;
}
