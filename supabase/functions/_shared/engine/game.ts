import { deal, nextSeat, otherTeam, sameCard, teamOf } from './cards.ts';
import { handOutcome } from './hand.ts';
import { manilhaRankFor, resolveTrick } from './strength.ts';
import type {
  ApplyResult,
  GameAction,
  HandSummary,
  HandValue,
  MatchState,
  PublicGameState,
  Rng,
  Seat,
  Team,
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
}

export function getLegalActions(state: PublicGameState, seat: Seat): LegalActions {
  const none: LegalActions = {
    playCard: false,
    requestTruco: false,
    nextTrucoValue: null,
    respondTruco: false,
    raiseTruco: false,
    fold: false,
  };
  if (state.status !== 'playing') return none;

  const team = teamOf(seat);
  const myTurn = state.currentTurnSeat === seat;

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

function applyRule(state: MatchState, seat: Seat, action: GameAction, rng: Rng): ApplyResult {
  const pub = state.public;
  if (pub.status !== 'playing') return { ok: false, error: 'match_over' };

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
      // Correr na própria mão de 11 dá só 1 ponto ao adversário (D-05); fora dela, o valor da mão (D-07).
      const points = pub.maoDeOnze === team ? 1 : pub.handValue;
      const summary: HandSummary = { winner: otherTeam(team), points, reason: 'fold' };
      return { ok: true, event: { seat, action: action.type }, state: finishHand(pub, summary, rng) };
    }
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
        tableCards: [],
        lastHand: summary,
        winnerTeam,
      },
    };
  }

  const next = startHand(score, nextSeat(pub.dealerSeat), pub.handNumber + 1, rng, summary);
  // Mantém a última vaza visível para quem não viu a 4ª carta cair.
  return { ...next, public: { ...next.public, lastTrick: pub.lastTrick } };
}
