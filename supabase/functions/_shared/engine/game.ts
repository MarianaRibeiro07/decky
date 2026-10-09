import { deal, nextSeat, otherTeam, sameCard, teamOf } from './cards.ts';
import { handOutcome } from './hand.ts';
import { manilhaRankFor, resolveTrick } from './strength.ts';
import type {
  ApplyResult,
  GameAction,
  HandSummary,
  HandValue,
  MatchState,
  ProposalStatus,
  PublicGameState,
  Rng,
  Seat,
  Team,
  TeamDecision,
  TeamProposal,
} from './types.ts';

export const WINNING_SCORE = 12;

const NEXT_VALUE: Record<HandValue, 3 | 6 | 9 | 12 | null> = { 1: 3, 3: 6, 6: 9, 9: 12, 12: null };

/** Ações que o assento pode fazer agora. Usado pelo servidor para validar e pelo app para mostrar botões. */
export interface LegalActions {
  playCard: boolean;
  requestTruco: boolean;
  /** Valor que será pedido, quando requestTruco for true. */
  nextTrucoValue: 3 | 6 | 9 | 12 | null;
  respondTruco: boolean;
  raiseTruco: boolean;
  fold: boolean;
  /** Há pedido da própria dupla feito pelo parceiro: pode confirmar. */
  confirmProposal: boolean;
  /** Há pedido da própria dupla: o parceiro pode recusar e quem pediu pode desistir. */
  rejectProposal: boolean;
}

export function getLegalActions(state: PublicGameState, seat: Seat): LegalActions {
  const none: LegalActions = {
    playCard: false,
    requestTruco: false,
    nextTrucoValue: null,
    respondTruco: false,
    raiseTruco: false,
    fold: false,
    confirmProposal: false,
    rejectProposal: false,
  };
  if (state.status !== 'playing') return none;

  const team = teamOf(seat);
  const myTurn = state.currentTurnSeat === seat;

  // Com a dupla decidindo, a partida para: só a própria dupla mexe no pedido.
  const proposal = state.proposal ?? null;
  if (proposal) {
    const ours = proposal.team === team;
    return { ...none, confirmProposal: ours && proposal.proposedBy !== seat, rejectProposal: ours };
  }

  if (state.truco) {
    const canRespond = state.truco.requestedBy !== team;
    return {
      ...none,
      respondTruco: canRespond,
      raiseTruco: canRespond && NEXT_VALUE[state.truco.value] !== null,
    };
  }

  const nextValue = NEXT_VALUE[state.handValue];
  const canRequest =
    myTurn &&
    state.maoDeOnze === null &&
    nextValue !== null &&
    (state.raiseRight === null || state.raiseRight === team);

  return {
    ...none,
    playCard: myTurn,
    requestTruco: canRequest,
    nextTrucoValue: canRequest ? nextValue : null,
    fold: true,
  };
}

/** Começa uma partida nova: placar zerado, assento 4 embaralha, assento 1 abre. */
export function newMatch(rng: Rng): MatchState {
  return startHand({ A: 0, B: 0 }, 4, 1, rng);
}

/** Distribui uma mão nova. Quem abre é o assento seguinte ao de quem embaralhou. */
export function startHand(
  score: Record<Team, number>,
  dealerSeat: Seat,
  handNumber: number,
  rng: Rng,
  lastHand: HandSummary | null = null,
): MatchState {
  const { hands, vira } = deal(rng);
  const maoDeOnze = maoDeOnzeFor(score);
  return {
    hands,
    public: {
      status: 'playing',
      handNumber,
      dealerSeat,
      score: { ...score },
      vira,
      manilhaRank: manilhaRankFor(vira),
      currentTurnSeat: nextSeat(dealerSeat),
      // Mão de 11 vale 3; mão de ferro (11 x 11) vale 1. Decisões D-05 e D-06.
      handValue: maoDeOnze === null ? 1 : maoDeOnze === 'both' ? 1 : 3,
      truco: null,
      raiseRight: null,
      maoDeOnze,
      tableCards: [],
      trickResults: [],
      lastTrick: null,
      lastHand,
      lastEvent: null,
      proposal: null,
      proposalSeq: 0,
      winnerTeam: null,
    },
  };
}

function maoDeOnzeFor(score: Record<Team, number>): Team | 'both' | null {
  const a = score.A === WINNING_SCORE - 1;
  const b = score.B === WINNING_SCORE - 1;
  if (a && b) return 'both';
  if (a) return 'A';
  if (b) return 'B';
  return null;
}

/**
 * Aplica uma ação ao estado. Função pura: não altera o estado recebido.
 * rng só é usado quando a ação encerra a mão e outra precisa ser distribuída.
 * O evento público aceito fica em `lastEvent`, para todos os aparelhos mostrarem o que aconteceu.
 */
export function applyAction(state: MatchState, seat: Seat, action: GameAction, rng: Rng): ApplyResult {
  const result = applyRule(state, seat, action, rng);
  if (!result.ok) return result;
  return { ...result, state: { ...result.state, public: { ...result.state.public, lastEvent: result.event } } };
}

/**
 * A decisão que esta ação representa, quando ela precisa da dupla inteira; null quando o jogador
 * decide sozinho. `value` é o que está em jogo (ver `TeamProposal.value`).
 * O app usa para avisar, no botão, que o parceiro vai precisar confirmar.
 */
export function teamDecisionFor(
  state: PublicGameState,
  seat: Seat,
  action: GameAction,
): { decision: TeamDecision; value: number } | null {
  switch (action.type) {
    case 'fold':
      return { decision: 'fold', value: foldPoints(state, teamOf(seat)) };
    case 'request_truco': {
      const next = NEXT_VALUE[state.handValue];
      return next !== null && next >= 6 ? { decision: 'request_truco', value: next } : null;
    }
    case 'respond_truco': {
      if (!state.truco) return null;
      if (action.response === 'refuse') return { decision: 'refuse', value: state.handValue };
      if (action.response === 'accept') return state.truco.value >= 6 ? { decision: 'accept', value: state.truco.value } : null;
      const raised = NEXT_VALUE[state.truco.value];
      return raised !== null ? { decision: 'raise', value: raised } : null;
    }
    default:
      return null;
  }
}

/** A ação que a dupla decidiu, aplicada quando o parceiro confirma. */
function decisionAction(decision: TeamDecision): GameAction {
  switch (decision) {
    case 'fold':
      return { type: 'fold' };
    case 'request_truco':
      return { type: 'request_truco' };
    default:
      return { type: 'respond_truco', response: decision };
  }
}

// Correr na própria mão de 11 dá só 1 ponto ao adversário (D-05); fora dela, o valor da mão (D-07).
const foldPoints = (pub: PublicGameState, team: Team) => (pub.maoDeOnze === team ? 1 : pub.handValue);

/**
 * Porta de entrada das regras. Decisões da dupla (`teamDecisionFor`) não são aplicadas na hora:
 * viram um pedido que o parceiro confirma ou recusa. Enquanto o pedido existe, nenhuma outra ação
 * é aceita, então nada muda por baixo dele e a mão não termina antes da resposta.
 */
function applyRule(state: MatchState, seat: Seat, action: GameAction, rng: Rng): ApplyResult {
  const pub = state.public;
  if (pub.status !== 'playing') return { ok: false, error: 'match_over' };
  if (action.type === 'confirm_proposal' || action.type === 'reject_proposal') {
    return answerProposal(state, seat, action, rng);
  }
  if (pub.proposal) return { ok: false, error: 'illegal_action' };

  const decision = teamDecisionFor(pub, seat, action);
  if (!decision) return executeRule(state, seat, action, rng);

  // Só vira pedido o que seria aceito agora: a mesma validação, sem guardar o resultado.
  // O gerador fixo evita gastar o sorteio de verdade numa mão que não vai ser distribuída.
  const check = executeRule(state, seat, action, () => 0);
  if (!check.ok) return check;
  const id = (pub.proposalSeq ?? 0) + 1;
  const proposal: TeamProposal = {
    id,
    team: teamOf(seat),
    decision: decision.decision,
    proposedBy: seat,
    value: decision.value,
    handNumber: pub.handNumber,
  };
  return {
    ok: true,
    event: { ...check.event, proposal: { id, status: 'opened', decision: decision.decision, by: seat } },
    state: { hands: state.hands, public: { ...pub, proposal, proposalSeq: id } },
  };
}

/**
 * Resposta a um pedido da dupla. Só a própria dupla responde, e só ao pedido em aberto (pelo número).
 * - Recusar: o parceiro recusa ('rejected') ou quem pediu desiste ('cancelled'); nada é aplicado.
 * - Confirmar: só o parceiro (quem pediu já contou). A ação é validada de novo, como se fosse feita
 *   agora por quem pediu; se não valer mais, o pedido acaba como 'invalidated', sem efeito.
 */
function answerProposal(
  state: MatchState,
  seat: Seat,
  action: Extract<GameAction, { type: 'confirm_proposal' | 'reject_proposal' }>,
  rng: Rng,
): ApplyResult {
  const pub = state.public;
  const proposal = pub.proposal ?? null;
  if (!proposal || proposal.id !== action.proposalId || proposal.team !== teamOf(seat)) {
    return { ok: false, error: 'illegal_action' };
  }
  const info = (status: ProposalStatus) => ({ id: proposal.id, status, decision: proposal.decision, by: seat });
  const cleared: MatchState = { hands: state.hands, public: { ...pub, proposal: null } };

  if (action.type === 'reject_proposal') {
    const status = seat === proposal.proposedBy ? 'cancelled' : 'rejected';
    return { ok: true, event: { seat, action: action.type, proposal: info(status) }, state: cleared };
  }

  // Um jogador sozinho não confirma pela dupla: quem pediu não confirma o próprio pedido.
  if (seat === proposal.proposedBy) return { ok: false, error: 'illegal_action' };

  const decided = decisionAction(proposal.decision);
  const stillSame =
    proposal.handNumber === pub.handNumber &&
    teamDecisionFor(cleared.public, proposal.proposedBy, decided)?.value === proposal.value;
  const result = stillSame ? executeRule(cleared, proposal.proposedBy, decided, rng) : null;
  if (!result || !result.ok) {
    return { ok: true, event: { seat, action: action.type, proposal: info('invalidated') }, state: cleared };
  }
  // O evento descreve a ação da dupla (pelo lugar de quem pediu), para os avisos da mesa saírem iguais.
  return { ...result, event: { ...result.event, proposal: info('confirmed') } };
}

/** Valida e aplica uma ação individual (ou a decisão já confirmada pela dupla). */
function executeRule(state: MatchState, seat: Seat, action: GameAction, rng: Rng): ApplyResult {
  const pub = state.public;
  const legal = getLegalActions(pub, seat);
  const team = teamOf(seat);

  switch (action.type) {
    case 'play_card': {
      if (pub.truco) return { ok: false, error: 'illegal_action' };
      if (!legal.playCard) return { ok: false, error: 'not_your_turn' };
      const hand = state.hands[seat - 1];
      const index = hand.findIndex((c) => sameCard(c, action.card));
      if (index === -1) return { ok: false, error: 'invalid_card' };

      const hands = state.hands.map((h) => [...h]);
      const [card] = hands[seat - 1].splice(index, 1);
      const tableCards = [...pub.tableCards, { seat, card }];
      const event = { seat, action: action.type, card };

      if (tableCards.length < 4) {
        return {
          ok: true,
          event,
          state: { hands, public: { ...pub, tableCards, currentTurnSeat: nextSeat(seat) } },
        };
      }

      const trick = resolveTrick(tableCards, pub.manilhaRank);
      const trickResults = [...pub.trickResults, trick.result];
      const afterTrick: PublicGameState = {
        ...pub,
        tableCards: [],
        trickResults,
        lastTrick: { cards: tableCards, result: trick.result },
        currentTurnSeat: trick.leadSeat,
      };

      const outcome = handOutcome(trickResults);
      if (outcome === null) return { ok: true, event, state: { hands, public: afterTrick } };

      const summary: HandSummary =
        outcome === 'none'
          ? { winner: null, points: 0, reason: 'all_tied' }
          : { winner: outcome, points: pub.handValue, reason: 'tricks' };
      return { ok: true, event, state: finishHand(afterTrick, summary, rng) };
    }

    case 'request_truco': {
      if (!legal.requestTruco || legal.nextTrucoValue === null) {
        return { ok: false, error: pub.truco || pub.currentTurnSeat === seat ? 'illegal_action' : 'not_your_turn' };
      }
      return {
        ok: true,
        event: { seat, action: action.type },
        state: {
          hands: state.hands,
          public: { ...pub, truco: { value: legal.nextTrucoValue, requestedBy: team, requestedBySeat: seat } },
        },
      };
    }

    case 'respond_truco': {
      const truco = pub.truco;
      if (!truco || !legal.respondTruco) return { ok: false, error: 'illegal_action' };
      const event = { seat, action: action.type, response: action.response };

      if (action.response === 'accept') {
        return {
          ok: true,
          event,
          state: {
            hands: state.hands,
            // Depois do aceite, só quem aceitou pode pedir o próximo aumento (D-08).
            public: { ...pub, handValue: truco.value, truco: null, raiseRight: team },
          },
        };
      }

      if (action.response === 'refuse') {
        // A dupla que pediu ganha o valor vigente antes do pedido recusado.
        const summary: HandSummary = { winner: truco.requestedBy, points: pub.handValue, reason: 'refused' };
        return { ok: true, event, state: finishHand(pub, summary, rng) };
      }

      // raise: aceita o pedido atual e devolve um pedido maior.
      const raised = NEXT_VALUE[truco.value];
      if (!legal.raiseTruco || raised === null) return { ok: false, error: 'illegal_action' };
      return {
        ok: true,
        event,
        state: {
          hands: state.hands,
          public: {
            ...pub,
            handValue: truco.value,
            truco: { value: raised, requestedBy: team, requestedBySeat: seat },
          },
        },
      };
    }

    case 'fold': {
      if (!legal.fold) return { ok: false, error: 'illegal_action' };
      const summary: HandSummary = { winner: otherTeam(team), points: foldPoints(pub, team), reason: 'fold' };
      return { ok: true, event: { seat, action: action.type }, state: finishHand(pub, summary, rng) };
    }

    default:
      // Confirmar e recusar pedido passam por `answerProposal`.
      return { ok: false, error: 'illegal_action' };
  }
}

/** Soma os pontos e encerra a partida ou distribui a próxima mão. */
function finishHand(pub: PublicGameState, summary: HandSummary, rng: Rng): MatchState {
  const score = { ...pub.score };
  if (summary.winner) {
    score[summary.winner] = Math.min(WINNING_SCORE, score[summary.winner] + summary.points);
  }

  const winnerTeam = (['A', 'B'] as const).find((t) => score[t] >= WINNING_SCORE) ?? null;
  if (winnerTeam) {
    return {
      hands: [[], [], [], []],
      public: {
        ...pub,
        status: 'finished',
        score,
        truco: null,
        proposal: null,
        tableCards: [],
        lastHand: summary,
        winnerTeam,
      },
    };
  }

  const next = startHand(score, nextSeat(pub.dealerSeat), pub.handNumber + 1, rng, summary);
  // Mantém a última vaza visível para quem não viu a 4ª carta cair. A numeração dos pedidos
  // continua de onde parou: um número nunca volta a valer em outra mão.
  return { ...next, public: { ...next.public, lastTrick: pub.lastTrick, proposalSeq: pub.proposalSeq ?? 0 } };
}
