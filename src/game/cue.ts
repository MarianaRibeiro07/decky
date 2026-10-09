// O que a mesa anuncia depois de uma ação aceita pelo servidor (pedido de truco, aceite, "Corro!").
// Puro, para ser testado sem React Native: decide O QUE mostrar a partir do estado já confirmado;
// os componentes só decidem COMO mostrar. Nenhuma regra do jogo depende disto.
import type { HandValue, PublicEvent, PublicGameState, Seat, TrucoRequest } from '../contracts/types';

/** Degraus da aposta: o aviso mostra em qual deles a mão está. */
export const TRUCO_LADDER = [3, 6, 9, 12] as const;

export type TableCue =
  /** Pedido de truco (ou aumento): ainda espera resposta da outra dupla. */
  | { kind: 'call'; seat: Seat; value: TrucoRequest['value']; raise: boolean }
  /** Pedido aceito: a mão passou a valer `value`. */
  | { kind: 'accept'; seat: Seat; value: HandValue }
  /** Fala curta junto de quem agiu ("Corro!"). */
  | { kind: 'speech'; seat: Seat; text: string };

const PROPOSAL_END_SPEECH = { rejected: 'Não!', cancelled: 'Desisti', invalidated: 'Cancelado' } as const;

/**
 * Aviso para o último evento, conferido contra o estado que veio junto com ele.
 * Pedido só vira aviso se há pedido pendente no estado; aceite só se o pedido já não está pendente
 * (a mão vale o novo valor). Assim a tela nunca anuncia algo que o servidor não confirmou.
 */
export function eventCue(event: PublicEvent | null | undefined, state: PublicGameState): TableCue | null {
  if (!event) return null;
  // Decisão da dupla: pedido aberto ainda não é ação (nada a anunciar); confirmado vira o aviso da
  // própria ação (logo abaixo); recusado, desistido ou inválido vira uma fala curta de quem respondeu.
  const proposal = event.proposal;
  if (proposal && proposal.status !== 'confirmed') {
    if (proposal.status === 'opened') return null;
    return { kind: 'speech', seat: proposal.by, text: PROPOSAL_END_SPEECH[proposal.status] };
  }
  switch (event.action) {
    case 'request_truco':
      return state.truco ? { kind: 'call', seat: event.seat, value: state.truco.value, raise: false } : null;
    case 'respond_truco':
      if (event.response === 'accept') {
        return state.truco === null ? { kind: 'accept', seat: event.seat, value: state.handValue } : null;
      }
      if (event.response === 'raise') {
        // Aumentar aceita o pedido anterior e devolve um maior: o aviso é o do novo pedido.
        return state.truco ? { kind: 'call', seat: event.seat, value: state.truco.value, raise: true } : null;
      }
      return { kind: 'speech', seat: event.seat, text: 'Corro!' };
    case 'fold':
      return { kind: 'speech', seat: event.seat, text: 'Corro!' };
    default:
      return null;
  }
}

/**
 * Quantas revisões podem chegar de uma vez e ainda contar como "agora". O Realtime avisa cada
 * mudança, mas leituras se juntam (uma por vez) e o polling cobre 4 s: duas ou três revisões numa
 * leitura são normais. Um salto maior é retomada (app voltou do segundo plano, rede caiu): o último
 * evento já é passado e não deve ser anunciado como se tivesse acabado de acontecer.
 */
export const MAX_REVISION_GAP = 3;

/**
 * Esta revisão nova deve ser anunciada?
 * - `previous` null: primeira leitura da tela (abrir, remontar, reconectar) não repete aviso antigo.
 * - `resynced`: a conexão caiu desde a última revisão vista; a leitura que a recupera não anuncia.
 */
export function shouldAnnounce(previous: number | null, revision: number, resynced: boolean): boolean {
  if (previous === null || resynced) return false;
  if (revision <= previous) return false;
  return revision - previous <= MAX_REVISION_GAP;
}

/** Quanto tempo cada aviso fica na mesa, em ms. Só apresentação: o estado do jogo não espera por ele. */
export function cueDuration(cue: TableCue): number {
  switch (cue.kind) {
    case 'call':
      return 2600;
    case 'accept':
      return 2200;
    case 'speech':
      return 3000;
  }
}

/** Degrau da aposta (0 = truco, 3 = doze): o aviso cresce de leve a cada degrau, sem mudar de linguagem. */
export function trucoTier(value: number): number {
  const i = TRUCO_LADDER.indexOf(value as (typeof TRUCO_LADDER)[number]);
  return i < 0 ? 0 : i;
}
