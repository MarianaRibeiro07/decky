// O que a linha de status da mesa diz agora. Puro, para ser testado sem React Native.
import type { PublicGameState, Seat } from '../contracts/types';
import type { DealPhase } from './deal';
import { describeHand, describeTrick, seatTeam, teamLabel, trucoName } from './describe';

export type StatusTone = 'turn' | 'truco' | 'info';

export interface StatusText {
  main: string;
  tone: StatusTone;
  /** O que acabou de acontecer (fim de vaza ou de mão). */
  recap: string | null;
  /** Regra especial em vigor (mão de 11, mão de ferro). */
  extra: string | null;
}

interface Input {
  state: PublicGameState;
  /** Assento de quem olha; null na mesa central. */
  viewerSeat: Seat | null;
  nameOf: (seat: Seat) => string;
  /** Quem olha pode responder ao truco pendente. */
  canRespond: boolean;
  phase: DealPhase;
}

export function statusText({ state, viewerSeat, nameOf, canRespond, phase }: Input): StatusText | null {
  if (state.status === 'finished') return null;
  const viewerTeam = viewerSeat ? seatTeam(viewerSeat) : null;

  let recap: string | null = null;
  if (state.tableCards.length === 0) {
    if (state.trickResults.length === 0 && state.lastHand) recap = describeHand(state.lastHand, viewerTeam);
    else if (state.lastTrick) recap = describeTrick(state.lastTrick.result, viewerTeam);
  }

  const extra = state.maoDeOnze
    ? state.maoDeOnze === 'both'
      ? 'Mão de ferro: vale 1, sem truco.'
      : `Mão de 11 (${teamLabel(state.maoDeOnze, viewerTeam)}): vale 3, sem truco.`
    : null;

  if (phase === 'intro' || phase === 'dealing') {
    return { main: 'Distribuindo as cartas…', tone: 'info', recap, extra };
  }
  if (phase === 'reveal') {
    return { main: 'Revelando a vira…', tone: 'info', recap, extra };
  }

  if (state.truco) {
    const who = nameOf(state.truco.requestedBySeat);
    const call = trucoName(state.truco.value);
    const answering = teamLabel(state.truco.requestedBy === 'A' ? 'B' : 'A', viewerTeam);
    let main: string;
    if (viewerTeam === null) main = `${who} pediu ${call}! ${answering} responde.`;
    else if (canRespond) main = `${who} pediu ${call}! Responda abaixo.`;
    else main = `${who} pediu ${call}. Aguardando a resposta deles.`;
    return { main, tone: 'truco', recap, extra };
  }

  if (viewerSeat !== null && state.currentTurnSeat === viewerSeat) {
    return { main: 'Sua vez! Escolha uma carta.', tone: 'turn', recap, extra };
  }
  return { main: `Vez de ${nameOf(state.currentTurnSeat)}`, tone: 'info', recap, extra };
}
