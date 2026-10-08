// Textos curtos da mesa, sempre do ponto de vista de quem está olhando ("Nós" e "Eles").
import type { HandSummary, Seat, Team, TrickResult } from '../contracts/types';

const TRUCO_NAMES: Record<number, string> = { 3: 'TRUCO', 6: 'SEIS', 9: 'NOVE', 12: 'DOZE' };

export function trucoName(value: number): string {
  return TRUCO_NAMES[value] ?? String(value);
}

export function teamLabel(team: Team, myTeam: Team): string {
  return team === myTeam ? 'Nós' : 'Eles';
}

export function describeTrick(result: TrickResult, myTeam: Team): string {
  if (result === 'tie') return 'Vaza empatada';
  return result === myTeam ? 'Vaza nossa' : 'Vaza deles';
}

export function describeHand(summary: HandSummary, myTeam: Team): string {
  if (summary.winner === null) return 'Mão empatada: ninguém pontua';
  const plus = `+${summary.points} ${summary.points === 1 ? 'ponto' : 'pontos'}`;
  const ours = summary.winner === myTeam;
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

/** Posição de cada assento na tela, com o próprio jogador sempre embaixo. */
export function tablePositions(mySeat: Seat): Record<'bottom' | 'right' | 'top' | 'left', Seat> {
  const next = (s: Seat, n: number) => (((s - 1 + n) % 4) + 1) as Seat;
  return { bottom: mySeat, right: next(mySeat, 1), top: next(mySeat, 2), left: next(mySeat, 3) };
}

/** Cartas que ainda estão na mão de um assento (para mostrar os versos). */
export function cardsLeft(seat: Seat, tricksDone: number, tableSeats: Seat[], finished: boolean): number {
  if (finished) return 0;
  return 3 - tricksDone - (tableSeats.includes(seat) ? 1 : 0);
}
