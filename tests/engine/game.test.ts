import { describe, expect, it } from 'vitest';
import {
  applyAction,
  getLegalActions,
  handOutcome,
  manilhaRankFor,
  newMatch,
  seededRng,
  startHand,
} from '../../supabase/functions/_shared/engine/index.ts';
import type {
  ApplyResult,
  Card,
  GameAction,
  MatchState,
  Rank,
  Seat,
  Suit,
  Team,
} from '../../supabase/functions/_shared/engine/index.ts';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const rng = seededRng(42);

/** Mão controlada: vira 3 (manilha 4), placar e mãos escolhidos pelo teste. */
function fixedHand(hands: Card[][], score: Record<Team, number> = { A: 0, B: 0 }): MatchState {
  const base = startHand(score, 4, 1, seededRng(1));
  const vira = c('3', 'ouros');
  return { hands, public: { ...base.public, vira, manilhaRank: manilhaRankFor(vira) } };
}

function ok(result: ApplyResult): MatchState {
  if (!result.ok) throw new Error(`ação rejeitada: ${result.error}`);
  return result.state;
}

function play(state: MatchState, seat: Seat, card: Card): MatchState {
  return ok(applyAction(state, seat, { type: 'play_card', card }, rng));
}

const partner = (seat: Seat) => (((seat + 1) % 4) + 1) as Seat;

/** Decisão da dupla (correr, 6, 9, 12): quem age abre o pedido e o parceiro confirma. */
function together(state: MatchState, seat: Seat, action: GameAction): MatchState {
  const opened = ok(applyAction(state, seat, action, rng));
  expect(opened.public.proposal).toMatchObject({ proposedBy: seat });
  return ok(applyAction(opened, partner(seat), { type: 'confirm_proposal', proposalId: opened.public.proposal!.id }, rng));
}

// Assento 1 tem as cartas fortes; assim a dupla A vence as vazas que quiser.
const strongA = [
  [c('3', 'paus'), c('3', 'copas'), c('3', 'espadas')],
  [c('5', 'ouros'), c('5', 'copas'), c('5', 'espadas')],
  [c('6', 'ouros'), c('6', 'copas'), c('6', 'espadas')],
  [c('7', 'ouros'), c('7', 'copas'), c('7', 'espadas')],
];

describe('resultado da mão', () => {
  it.each([
    [['A', 'A'], 'A'],
    [['B', 'A', 'B'], 'B'],
    [['A', 'B'], null],
    [['tie', 'B'], 'B'],
    [['A', 'tie'], 'A'],
    [['tie', 'tie'], null],
    [['tie', 'tie', 'A'], 'A'],
    [['tie', 'tie', 'tie'], 'none'],
    [['A', 'B', 'tie'], 'A'],
    [['B', 'A', 'tie'], 'B'],
    [['A'], null],
  ] as const)('%j termina em %s', (results, expected) => {
    expect(handOutcome(results)).toBe(expected);
  });
});

describe('jogar carta', () => {
  it('quem está depois de quem embaralhou abre; a vez gira', () => {
    let state = fixedHand(strongA);
    expect(state.public.currentTurnSeat).toBe(1);
    state = play(state, 1, c('3', 'paus'));
    expect(state.public.currentTurnSeat).toBe(2);
    expect(state.public.tableCards).toEqual([{ seat: 1, card: c('3', 'paus') }]);
    expect(state.hands[0]).toHaveLength(2);
  });

  it('rejeita jogada fora da vez', () => {
    const result = applyAction(fixedHand(strongA), 2, { type: 'play_card', card: c('5', 'ouros') }, rng);
    expect(result).toEqual({ ok: false, error: 'not_your_turn' });
  });

  it('rejeita carta que não está na mão e carta já jogada', () => {
    const state = fixedHand(strongA);
    expect(applyAction(state, 1, { type: 'play_card', card: c('5', 'ouros') }, rng)).toEqual({
      ok: false,
      error: 'invalid_card',
    });
    let after = play(state, 1, c('3', 'paus'));
    after = play(after, 2, c('5', 'ouros'));
    after = play(after, 3, c('6', 'ouros'));
    after = play(after, 4, c('7', 'ouros'));
    // Assento 1 venceu a vaza e abre de novo, mas o 3 de paus já foi.
    expect(applyAction(after, 1, { type: 'play_card', card: c('3', 'paus') }, rng)).toEqual({
      ok: false,
      error: 'invalid_card',
    });
  });

  it('não altera o estado recebido', () => {
    const state = fixedHand(strongA);
    const copy = structuredClone(state);
    play(state, 1, c('3', 'paus'));
    expect(state).toEqual(copy);
  });

  it('duas vazas vencem a mão, somam o valor e distribuem a próxima', () => {
    let state = fixedHand(strongA);
    for (const card of [c('3', 'paus'), c('3', 'copas')]) {
      state = play(state, 1, card);
      state = play(state, 2, state.hands[1][0]);
      state = play(state, 3, state.hands[2][0]);
      state = play(state, 4, state.hands[3][0]);
    }
    expect(state.public.score).toEqual({ A: 1, B: 0 });
    expect(state.public.lastHand).toEqual({ winner: 'A', points: 1, reason: 'tricks' });
    expect(state.public.handNumber).toBe(2);
    expect(state.public.dealerSeat).toBe(1);
    expect(state.public.currentTurnSeat).toBe(2);
    expect(state.public.trickResults).toEqual([]);
    state.hands.forEach((hand) => expect(hand).toHaveLength(3));
  });
});

describe('truco', () => {
  const ask = (s: MatchState, seat: Seat) => applyAction(s, seat, { type: 'request_truco' }, rng);
  const answer = (s: MatchState, seat: Seat, response: 'accept' | 'refuse' | 'raise') =>
    applyAction(s, seat, { type: 'respond_truco', response }, rng);

  it('pedido na vez fica pendente e bloqueia jogadas', () => {
    const state = ok(ask(fixedHand(strongA), 1));
    expect(state.public.truco).toEqual({ value: 3, requestedBy: 'A', requestedBySeat: 1 });
    expect(applyAction(state, 1, { type: 'play_card', card: c('3', 'paus') }, rng)).toEqual({
      ok: false,
      error: 'illegal_action',
    });
  });

  it('só pede quem está na vez', () => {
    expect(ask(fixedHand(strongA), 2)).toEqual({ ok: false, error: 'not_your_turn' });
  });

  it('não aceita pedido simultâneo nem resposta da própria dupla', () => {
    const state = ok(ask(fixedHand(strongA), 1));
    expect(ask(state, 1)).toEqual({ ok: false, error: 'illegal_action' });
    expect(answer(state, 3, 'accept')).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('aceite muda o valor e passa o direito de aumentar para quem aceitou', () => {
    const state = ok(answer(ok(ask(fixedHand(strongA), 1)), 2, 'accept'));
    expect(state.public.handValue).toBe(3);
    expect(state.public.truco).toBeNull();
    expect(state.public.raiseRight).toBe('B');
    // A dupla A não pode pedir 6 logo depois de ter o truco aceito.
    expect(getLegalActions(state.public, 1).requestTruco).toBe(false);
  });

  it('recusa dá à dupla que pediu os pontos de antes do pedido', () => {
    const accepted = ok(answer(ok(ask(fixedHand(strongA), 1)), 4, 'accept')); // vale 3, direito com B
    const afterB = play(accepted, 1, c('3', 'paus')); // vez do 2
    const askedSix = together(afterB, 2, { type: 'request_truco' });
    expect(askedSix.public.truco?.value).toBe(6);
    const refused = together(askedSix, 3, { type: 'respond_truco', response: 'refuse' });
    expect(refused.public.score).toEqual({ A: 0, B: 3 });
    expect(refused.public.lastHand).toEqual({ winner: 'B', points: 3, reason: 'refused' });
    expect(refused.public.handNumber).toBe(2);
  });

  it('aumentar aceita o pedido atual e devolve o seguinte', () => {
    const raised = together(ok(ask(fixedHand(strongA), 1)), 2, { type: 'respond_truco', response: 'raise' });
    expect(raised.public.handValue).toBe(3);
    expect(raised.public.truco).toEqual({ value: 6, requestedBy: 'B', requestedBySeat: 2 });
    const accepted = together(raised, 3, { type: 'respond_truco', response: 'accept' });
    expect(accepted.public.handValue).toBe(6);
    expect(accepted.public.raiseRight).toBe('A');
  });

  it('sobe 3, 6, 9, 12 e para em 12', () => {
    const raise = { type: 'respond_truco', response: 'raise' } as const;
    let state = ok(ask(fixedHand(strongA), 1)); // A pede 3 (sozinho)
    state = together(state, 2, raise); // B pede 6
    state = together(state, 1, raise); // A pede 9
    state = together(state, 2, raise); // B pede 12
    expect(state.public.truco?.value).toBe(12);
    expect(answer(state, 1, 'raise')).toEqual({ ok: false, error: 'illegal_action' });
    state = together(state, 1, { type: 'respond_truco', response: 'accept' });
    expect(state.public.handValue).toBe(12);
    expect(getLegalActions(state.public, 1).requestTruco).toBe(false);
  });

  it('o placar não passa de 12 e a partida termina', () => {
    const state = together(ok(ask(fixedHand(strongA, { A: 10, B: 4 }), 1)), 2, { type: 'respond_truco', response: 'refuse' });
    expect(state.public.status).toBe('playing');
    expect(state.public.score.A).toBe(11);
    const accepted = ok(answer(ok(ask(fixedHand(strongA, { A: 10, B: 4 }), 1)), 2, 'accept'));
    let s = accepted;
    for (const card of [c('3', 'paus'), c('3', 'copas')]) {
      s = play(s, 1, card);
      s = play(s, 2, s.hands[1][0]);
      s = play(s, 3, s.hands[2][0]);
      s = play(s, 4, s.hands[3][0]);
    }
    expect(s.public.score).toEqual({ A: 12, B: 4 });
    expect(s.public.status).toBe('finished');
    expect(s.public.winnerTeam).toBe('A');
    expect(applyAction(s, 2, { type: 'fold' }, rng)).toEqual({ ok: false, error: 'match_over' });
  });
});

describe('correr e mão de 11', () => {
  it('correr dá ao adversário o valor da mão', () => {
    const state = together(fixedHand(strongA), 3, { type: 'fold' });
    expect(state.public.score).toEqual({ A: 0, B: 1 });
    expect(state.public.lastHand?.reason).toBe('fold');
  });

  it('mão de 11 vale 3 e não tem truco', () => {
    const state = startHand({ A: 11, B: 5 }, 4, 9, seededRng(3));
    expect(state.public.maoDeOnze).toBe('A');
    expect(state.public.handValue).toBe(3);
    expect(getLegalActions(state.public, 1).requestTruco).toBe(false);
    expect(applyAction(state, 1, { type: 'request_truco' }, rng)).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('correr na própria mão de 11 dá só 1 ponto', () => {
    const state = together(startHand({ A: 11, B: 5 }, 4, 9, seededRng(3)), 1, { type: 'fold' });
    expect(state.public.score).toEqual({ A: 11, B: 6 });
  });

  it('mão de ferro (11 a 11) vale 1 e não tem truco', () => {
    const state = startHand({ A: 11, B: 11 }, 4, 9, seededRng(3));
    expect(state.public.maoDeOnze).toBe('both');
    expect(state.public.handValue).toBe(1);
    expect(getLegalActions(state.public, 1).requestTruco).toBe(false);
  });
});

describe('decisão em dupla', () => {
  const fold = { type: 'fold' } as const;
  const confirm = (s: MatchState, seat: Seat, id = s.public.proposal!.id) =>
    applyAction(s, seat, { type: 'confirm_proposal', proposalId: id }, rng);
  const reject = (s: MatchState, seat: Seat, id = s.public.proposal!.id) =>
    applyAction(s, seat, { type: 'reject_proposal', proposalId: id }, rng);
  const respond = (response: 'accept' | 'refuse' | 'raise') => ({ type: 'respond_truco', response }) as const;

  it('só um integrante correr não encerra a mão e para a partida', () => {
    const start = fixedHand(strongA);
    const opened = ok(applyAction(start, 3, fold, rng));
    expect(opened.public.proposal).toEqual({ id: 1, team: 'A', decision: 'fold', proposedBy: 3, value: 1, handNumber: 1 });
    expect(opened.public.score).toEqual({ A: 0, B: 0 });
    expect(opened.public.handNumber).toBe(1);
    expect(opened.public.lastEvent).toEqual({
      seat: 3,
      action: 'fold',
      proposal: { id: 1, status: 'opened', decision: 'fold', by: 3 },
    });
    // Ninguém joga nem pede enquanto a dupla decide, nem a outra dupla.
    expect(applyAction(opened, 1, { type: 'play_card', card: c('3', 'paus') }, rng)).toEqual({ ok: false, error: 'illegal_action' });
    expect(applyAction(opened, 1, { type: 'request_truco' }, rng)).toEqual({ ok: false, error: 'illegal_action' });
    expect(applyAction(opened, 2, fold, rng)).toEqual({ ok: false, error: 'illegal_action' });
    expect(applyAction(opened, 1, fold, rng)).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('os dois confirmam correr: a outra dupla ganha e o evento é o "corro" de quem pediu', () => {
    const state = ok(confirm(ok(applyAction(fixedHand(strongA), 3, fold, rng)), 1));
    expect(state.public.score).toEqual({ A: 0, B: 1 });
    expect(state.public.lastHand).toEqual({ winner: 'B', points: 1, reason: 'fold' });
    expect(state.public.proposal ?? null).toBeNull();
    expect(state.public.lastEvent).toEqual({
      seat: 3,
      action: 'fold',
      proposal: { id: 1, status: 'confirmed', decision: 'fold', by: 1 },
    });
  });

  it('o parceiro recusa ou quem pediu desiste: nada acontece e o jogo segue', () => {
    const start = fixedHand(strongA);
    const opened = ok(applyAction(start, 3, fold, rng));
    const rejected = ok(reject(opened, 1));
    expect(rejected.public).toMatchObject({ proposal: null, score: start.public.score, handNumber: 1, currentTurnSeat: 1 });
    expect(rejected.public.lastEvent).toEqual({
      seat: 1,
      action: 'reject_proposal',
      proposal: { id: 1, status: 'rejected', decision: 'fold', by: 1 },
    });
    expect(applyAction(rejected, 1, { type: 'play_card', card: c('3', 'paus') }, rng).ok).toBe(true);

    const cancelled = ok(reject(opened, 3));
    expect(cancelled.public.lastEvent?.proposal?.status).toBe('cancelled');
    expect(cancelled.public.proposal).toBeNull();
  });

  it('um jogador sozinho não vale pela dupla e a outra dupla não responde', () => {
    const opened = ok(applyAction(fixedHand(strongA), 3, fold, rng));
    expect(confirm(opened, 3)).toEqual({ ok: false, error: 'illegal_action' });
    expect(confirm(opened, 2)).toEqual({ ok: false, error: 'illegal_action' });
    expect(reject(opened, 4)).toEqual({ ok: false, error: 'illegal_action' });
    // Repetir o pedido também não conta como segunda confirmação.
    expect(applyAction(opened, 3, fold, rng)).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('confirmação de um pedido antigo não vale para o novo, nem em outra mão', () => {
    const first = ok(applyAction(fixedHand(strongA), 3, fold, rng));
    const second = ok(applyAction(ok(reject(first, 1)), 3, fold, rng));
    expect(second.public.proposal?.id).toBe(2);
    expect(confirm(second, 1, 1)).toEqual({ ok: false, error: 'illegal_action' });
    const nextHand = ok(confirm(second, 1, 2));
    expect(nextHand.public.handNumber).toBe(2);
    expect(nextHand.public.proposalSeq).toBe(2);
    const third = ok(applyAction(nextHand, 2, fold, rng));
    expect(third.public.proposal?.id).toBe(3);
    expect(confirm(third, 4, 2)).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('sem pedido em aberto, confirmar ou recusar é ilegal', () => {
    expect(confirm(fixedHand(strongA), 1, 1)).toEqual({ ok: false, error: 'illegal_action' });
    expect(reject(fixedHand(strongA), 1, 1)).toEqual({ ok: false, error: 'illegal_action' });
  });

  it('truco de 3 e o aceite do 3 continuam individuais', () => {
    const asked = ok(applyAction(fixedHand(strongA), 1, { type: 'request_truco' }, rng));
    expect(asked.public.proposal).toBeNull();
    expect(asked.public.truco?.value).toBe(3);
    const accepted = ok(applyAction(asked, 2, respond('accept'), rng));
    expect(accepted.public.proposal).toBeNull();
    expect(accepted.public.handValue).toBe(3);
  });

  it('pedir 6, 9 e 12 e aceitar 6, 9 e 12 precisam dos dois, e o valor só muda depois', () => {
    let state = ok(applyAction(fixedHand(strongA), 1, { type: 'request_truco' }, rng)); // A pede 3

    // B aumenta para 6: até o parceiro confirmar, o pedido continua o 3 de A e a mão vale 1.
    let opened = ok(applyAction(state, 2, respond('raise'), rng));
    expect(opened.public.proposal).toMatchObject({ team: 'B', decision: 'raise', value: 6 });
    expect(opened.public).toMatchObject({ handValue: 1, truco: { value: 3, requestedBy: 'A' } });
    state = ok(confirm(opened, 4));
    expect(state.public).toMatchObject({ handValue: 3, truco: { value: 6, requestedBy: 'B', requestedBySeat: 2 } });

    // A aceita o 6: a mão só passa a valer 6 com o parceiro.
    opened = ok(applyAction(state, 3, respond('accept'), rng));
    expect(opened.public.proposal).toMatchObject({ team: 'A', decision: 'accept', value: 6 });
    expect(opened.public.handValue).toBe(3);
    state = ok(confirm(opened, 1));
    expect(state.public).toMatchObject({ handValue: 6, truco: null, raiseRight: 'A' });

    // A pede 9 na vez dele (o 1 abre).
    opened = ok(applyAction(state, 1, { type: 'request_truco' }, rng));
    expect(opened.public.proposal).toMatchObject({ decision: 'request_truco', value: 9 });
    expect(opened.public.truco).toBeNull();
    state = ok(confirm(opened, 3));
    expect(state.public.truco).toEqual({ value: 9, requestedBy: 'A', requestedBySeat: 1 });

    // B aceita o 9 e depois pede 12; A aceita o 12.
    state = together(state, 4, respond('accept'));
    expect(state.public.handValue).toBe(9);
    state = play(state, 1, c('3', 'paus')); // vez do 2
    state = together(state, 2, { type: 'request_truco' });
    expect(state.public.truco?.value).toBe(12);
    opened = ok(applyAction(state, 1, respond('accept'), rng));
    expect(opened.public.handValue).toBe(9);
    state = ok(confirm(opened, 3));
    expect(state.public.handValue).toBe(12);
  });

  it('correr do truco (recusar) também precisa dos dois', () => {
    const asked = ok(applyAction(fixedHand(strongA), 1, { type: 'request_truco' }, rng));
    const opened = ok(applyAction(asked, 2, respond('refuse'), rng));
    expect(opened.public.proposal).toMatchObject({ decision: 'refuse', value: 1 });
    expect(opened.public.score).toEqual({ A: 0, B: 0 });
    const refused = ok(confirm(opened, 4));
    expect(refused.public.lastHand).toEqual({ winner: 'A', points: 1, reason: 'refused' });
  });

  it('pedido que não vale mais termina como inválido, sem efeito', () => {
    const opened = ok(applyAction(fixedHand(strongA), 3, fold, rng));
    // Estado adulterado: o valor em jogo mudou por baixo do pedido.
    const changed: MatchState = { ...opened, public: { ...opened.public, handValue: 3 } };
    const result = ok(confirm(changed, 1));
    expect(result.public.proposal).toBeNull();
    expect(result.public.score).toEqual({ A: 0, B: 0 });
    expect(result.public.lastEvent?.proposal).toEqual({ id: 1, status: 'invalidated', decision: 'fold', by: 1 });

    const otherHand: MatchState = { ...opened, public: { ...opened.public, handNumber: 2 } };
    expect(ok(confirm(otherHand, 1)).public.lastEvent?.proposal?.status).toBe('invalidated');
  });

  it('pedido só abre para ação que seria legal agora', () => {
    // Pedir 6 fora da vez continua "não é sua vez"; nada fica pendente.
    const accepted = ok(applyAction(ok(applyAction(fixedHand(strongA), 1, { type: 'request_truco' }, rng)), 2, respond('accept'), rng));
    expect(applyAction(accepted, 4, { type: 'request_truco' }, rng)).toEqual({ ok: false, error: 'not_your_turn' });
  });

  it('partida gravada antes desta versão (sem os campos novos) funciona', () => {
    const base = fixedHand(strongA);
    const { proposal: _p, proposalSeq: _s, ...legacy } = base.public;
    const opened = ok(applyAction({ ...base, public: legacy as typeof base.public }, 3, fold, rng));
    expect(opened.public.proposal?.id).toBe(1);
  });

  it('não altera o estado recebido', () => {
    const state = fixedHand(strongA);
    const copy = structuredClone(state);
    const opened = ok(applyAction(state, 3, fold, rng));
    const openedCopy = structuredClone(opened);
    confirm(opened, 1);
    expect(state).toEqual(copy);
    expect(opened).toEqual(openedCopy);
  });

  it('legalidade: a dupla vê confirmar/recusar; a outra dupla, nada', () => {
    const opened = ok(applyAction(fixedHand(strongA), 3, fold, rng)).public;
    expect(getLegalActions(opened, 1)).toMatchObject({ confirmProposal: true, rejectProposal: true, playCard: false, fold: false });
    expect(getLegalActions(opened, 3)).toMatchObject({ confirmProposal: false, rejectProposal: true });
    expect(getLegalActions(opened, 2)).toMatchObject({ confirmProposal: false, rejectProposal: false, fold: false });
  });
});

describe('partidas aleatórias', () => {
  it('jogando ações legais ao acaso, toda partida termina em 12 sem quebrar invariantes', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const random = seededRng(seed);
      let state = newMatch(random);
      for (let step = 0; state.public.status === 'playing'; step++) {
        expect(step).toBeLessThan(2000);
        const pub = state.public;
        const cardsPlayed = pub.trickResults.length * 4 + pub.tableCards.length;
        expect(state.hands.flat().length + cardsPlayed).toBe(12);

        const options: [Seat, GameAction][] = [];
        for (const seat of [1, 2, 3, 4] as Seat[]) {
          const legal = getLegalActions(pub, seat);
          if (legal.playCard) state.hands[seat - 1].forEach((card) => options.push([seat, { type: 'play_card', card }]));
          if (legal.requestTruco && random() < 0.3) options.push([seat, { type: 'request_truco' }]);
          if (legal.respondTruco) {
            options.push([seat, { type: 'respond_truco', response: 'accept' }]);
            options.push([seat, { type: 'respond_truco', response: 'refuse' }]);
          }
          if (legal.raiseTruco) options.push([seat, { type: 'respond_truco', response: 'raise' }]);
          if (legal.fold && random() < 0.02) options.push([seat, { type: 'fold' }]);
          const proposalId = pub.proposal?.id ?? 0;
          if (legal.confirmProposal) options.push([seat, { type: 'confirm_proposal', proposalId }]);
          if (legal.rejectProposal && random() < 0.3) options.push([seat, { type: 'reject_proposal', proposalId }]);
        }
        expect(options.length).toBeGreaterThan(0);
        const [seat, action] = options[Math.floor(random() * options.length)];
        state = ok(applyAction(state, seat, action, random));
        expect(state.public.score.A).toBeLessThanOrEqual(12);
        expect(state.public.score.B).toBeLessThanOrEqual(12);
      }
      expect(Math.max(state.public.score.A, state.public.score.B)).toBe(12);
      expect(state.public.winnerTeam).not.toBeNull();
    }
  });
});
