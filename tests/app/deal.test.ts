import { describe, expect, it } from 'vitest';
import { newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { PublicGameState } from '../../src/contracts/types';
import {
  DEAL_TIMING,
  arrivedCards,
  createDealTracker,
  dealBoundaries,
  dealKey,
  dealOrder,
  dealPhaseAt,
  dealPhaseChanges,
  dealPhaseNow,
  dealingDuration,
  isFreshDeal,
  landingMoments,
  landingTimes,
} from '../../src/game/deal';

const fresh = (): PublicGameState => newMatch(seededRng(1)).public;

describe('ordem da distribuição', () => {
  it('3 cartas por jogador, uma por vez, começando à direita de quem embaralha', () => {
    const steps = dealOrder(4);
    expect(steps).toHaveLength(12);
    expect(steps.slice(0, 4).map((s) => s.seat)).toEqual([1, 2, 3, 4]);
    expect(dealOrder(2).slice(0, 4).map((s) => s.seat)).toEqual([3, 4, 1, 2]);
    for (const seat of [1, 2, 3, 4]) expect(steps.filter((s) => s.seat === seat).map((s) => s.round)).toEqual([0, 1, 2]);
  });

  it('as cartas saem em sequência e cada jogador recebe as suas em momentos crescentes', () => {
    const steps = dealOrder(1);
    steps.forEach((s, i) => expect(s.delay).toBe(i * DEAL_TIMING.stagger));
    const times = landingTimes(1, 2);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(times[0]).toBe(DEAL_TIMING.flight);
    expect(Math.max(...[1, 2, 3, 4].flatMap((s) => landingTimes(1, s as 1)))).toBe(dealingDuration());
  });
});

describe('fases da animação', () => {
  it('pausa (só a partir da 2ª mão), distribuição, vira e fim, nesta ordem', () => {
    const b = dealBoundaries(true);
    expect(dealPhaseAt(0, true)).toBe('intro');
    expect(dealPhaseAt(b.dealing, true)).toBe('dealing');
    expect(dealPhaseAt(b.reveal, true)).toBe('reveal');
    expect(dealPhaseAt(b.done, true)).toBe('done');
    expect(dealPhaseAt(0, false)).toBe('dealing');
    expect(dealBoundaries(false).done).toBe(dealingDuration() + DEAL_TIMING.reveal);
  });

  it('a animação é curta: termina em menos de 4 segundos', () => {
    expect(dealBoundaries(true).done).toBeLessThan(4000);
  });
});

describe('animar uma vez por mão (reconexão e eventos repetidos)', () => {
  it('a mão recém-distribuída anima uma única vez; o mesmo estado de novo não reanima', () => {
    const tracker = createDealTracker();
    const state = fresh();
    const first = tracker.start(dealKey('m1', 1), state, 1000);
    expect(first).toEqual({ startedAt: 1000, intro: false });
    // Realtime repetido, polling ou remontagem da tela: devolve a MESMA execução (retoma, não recomeça).
    expect(tracker.start(dealKey('m1', 1), state, 5000)).toEqual(first);
  });

  it('entrar no meio da mão (reconexão depois de uma jogada) não anima', () => {
    const tracker = createDealTracker();
    const state = fresh();
    const midHand: PublicGameState = { ...state, tableCards: [{ seat: 1, card: { rank: '4', suit: 'ouros' } }] };
    expect(isFreshDeal(midHand)).toBe(false);
    expect(tracker.start(dealKey('m1', 1), midHand, 0)).toBeNull();
    // E continua sem animar mesmo se depois chegar um estado "limpo" da mesma mão.
    expect(tracker.start(dealKey('m1', 1), state, 10)).toBeNull();
  });

  it('mão nova anima de novo, com a pausa mostrando a vaza anterior', () => {
    const tracker = createDealTracker();
    const hand2: PublicGameState = {
      ...fresh(),
      handNumber: 2,
      lastTrick: { cards: [], result: 'A' },
    };
    expect(tracker.start(dealKey('m1', 2), hand2, 0)).toEqual({ startedAt: 0, intro: true });
    expect(tracker.start(dealKey('m2', 2), hand2, 0)).not.toBeNull();
  });

  it('partida encerrada não anima', () => {
    expect(isFreshDeal({ ...fresh(), status: 'finished' })).toBe(false);
  });
});

describe('sem quadro piscando na troca de mão', () => {
  it('a fase sai do relógio no mesmo render em que a mão nova chega (nunca começa em "done")', () => {
    const tracker = createDealTracker();
    const hand2: PublicGameState = { ...fresh(), handNumber: 2, lastTrick: { cards: [], result: 'B' } };
    const run = tracker.start(dealKey('m1', 2), hand2, 10_000);
    // Primeiro render com a mão nova: já está na pausa, com a mão e a vira fechadas.
    expect(dealPhaseNow(run, 10_000)).toBe('intro');
    expect(arrivedCards(run, hand2.dealerSeat, 1, 10_000)).toBe(0);
    expect(dealPhaseNow(null, 10_000)).toBe('done');
  });

  it('os redesenhos agendados caem exatamente nas trocas de fase', () => {
    const run = { startedAt: 1000, intro: true };
    const b = dealBoundaries(true);
    expect(dealPhaseChanges(run)).toEqual([1000 + b.dealing, 1000 + b.reveal, 1000 + b.done]);
    for (const at of dealPhaseChanges(run)) expect(dealPhaseNow(run, at)).not.toBe(dealPhaseNow(run, at - 1));
  });

  it('cada carta da própria mão chega quando a carta voadora pousa; no fim, todas', () => {
    const run = { startedAt: 0, intro: false };
    const moments = landingMoments(run, 4, 1);
    expect(moments).toHaveLength(3);
    expect(arrivedCards(run, 4, 1, moments[0] - 1)).toBe(0);
    expect(arrivedCards(run, 4, 1, moments[0])).toBe(1);
    expect(arrivedCards(run, 4, 1, moments[1])).toBe(2);
    expect(arrivedCards(run, 4, 1, moments[2])).toBe(3);
    expect(arrivedCards(run, 4, 1, dealBoundaries(false).done)).toBe(3);
    // Sem animação (reconexão no meio da mão): as três já estão lá.
    expect(arrivedCards(null, 4, 1, 0)).toBe(3);
  });

  it('remontar a tela no meio da distribuição retoma do ponto certo, sem repetir cartas', () => {
    const tracker = createDealTracker();
    const state = fresh();
    const run = tracker.start(dealKey('m9', 1), state, 0)!;
    const mid = landingMoments(run, state.dealerSeat, 2)[1];
    // "Nova" montagem pede a mesma mão mais tarde: mesma execução, mesmo progresso.
    const again = tracker.start(dealKey('m9', 1), state, mid);
    expect(again).toBe(run);
    expect(arrivedCards(again, state.dealerSeat, 2, mid)).toBe(2);
  });
});
