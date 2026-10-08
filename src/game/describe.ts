// Textos curtos da mesa. Para um jogador, do ponto de vista dele ("Nós" e "Eles");
// para a mesa central (viewerTeam = null), neutros ("Dupla A" e "Dupla B").
import type { HandSummary, PublicEvent, PublicGameState, Seat, Team, TrickResult } from '../contracts/types';

const TRUCO_NAMES: Record<number, string> = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };

export function trucoName(value: number): string {
  return TRUCO_NAMES[value] ?? String(value);
}

/** Próximo valor depois de um pedido (3 > 6 > 9 > 12). */
export function nextTrucoValue(value: number): number {
  return value === 3 ? 6 : value === 6 ? 9 : 12;
}

export function seatTeam(seat: Seat): Team {
  return seat % 2 === 1 ? 'A' : 'B';
}

export function teamLabel(team: Team, viewerTeam: Team | null): string {
  if (viewerTeam === null) return `Dupla ${team}`;
  return team === viewerTeam ? 'Nós' : 'Eles';
}

export function describeTrick(result: TrickResult, viewerTeam: Team | null): string {
  if (result === 'tie') return 'Vaza empatada';
  if (viewerTeam === null) return `Vaza da dupla ${result}`;
  return result === viewerTeam ? 'Vaza nossa' : 'Vaza deles';
}

export function describeHand(summary: HandSummary, viewerTeam: Team | null): string {
  if (summary.winner === null) return 'Mão empatada: ninguém pontua';
  const plus = `+${summary.points} ${summary.points === 1 ? 'ponto' : 'pontos'}`;

  if (viewerTeam === null) {
    const winner = `Dupla ${summary.winner}`;
    const loser = `Dupla ${summary.winner === 'A' ? 'B' : 'A'}`;
    switch (summary.reason) {
      case 'tricks':
        return `${winner} ganhou a mão (${plus})`;
      case 'refused':
        return `${loser} correu do truco (${plus} para a dupla ${summary.winner})`;
      case 'fold':
        return `${loser} correu (${plus} para a dupla ${summary.winner})`;
      default:
        return '';
    }
  }

  const ours = summary.winner === viewerTeam;
  switch (summary.reason) {
    case 'tricks':
      return ours ? `Ganhamos a mão (${plus})` : `Eles ganharam a mão (${plus})`;
    case 'refused':
      return ours ? `Eles correram do truco (${plus} para nós)` : `Corremos do truco (${plus} para eles)`;
    case 'fold':
      return ours ? `Eles correram (${plus} para nós)` : `Corremos (${plus} para eles)`;
    default:
      return '';
  }
}

/** Fala curta que aparece junto do jogador que agiu ("TRUCO!", "Aceito!"). Carta jogada não tem fala. */
export function eventBubble(event: PublicEvent | null | undefined, state: PublicGameState): string | null {
  if (!event) return null;
  switch (event.action) {
    case 'request_truco':
      return state.truco ? `${trucoName(state.truco.value)}!` : 'TRUCO!';
    case 'respond_truco':
      if (event.response === 'accept') return 'Aceito!';
      if (event.response === 'refuse') return 'Corro!';
      return state.truco ? `${trucoName(state.truco.value)}!` : 'Aumento!';
    case 'fold':
      return 'Corro!';
    default:
      return null;
  }
}

export type Side = 'bottom' | 'right' | 'top' | 'left';

/** Posição de cada assento na tela, com quem olha sempre embaixo (a mesa central usa o assento 1). */
export function tablePositions(bottomSeat: Seat): Record<Side, Seat> {
  const next = (s: Seat, n: number) => (((s - 1 + n) % 4) + 1) as Seat;
  return { bottom: bottomSeat, right: next(bottomSeat, 1), top: next(bottomSeat, 2), left: next(bottomSeat, 3) };
}

/** Cartas que ainda estão na mão de um assento (para mostrar os versos). */
export function cardsLeft(seat: Seat, tricksDone: number, tableSeats: Seat[], finished: boolean): number {
  if (finished) return 0;
  return 3 - tricksDone - (tableSeats.includes(seat) ? 1 : 0);
}
