import { describe, expect, it } from 'vitest';
import { newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { PublicGameState } from '../../src/contracts/types';
import {
  DEAL_TIMING,
  createDealTracker,
  dealBoundaries,
  dealKey,
  dealOrder,
  dealPhaseAt,
  dealingDuration,
  isFreshDeal,
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
