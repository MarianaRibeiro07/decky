import { describe, expect, it } from 'vitest';
import { newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import { manilhaRankFor } from '../../supabase/functions/_shared/engine/strength.ts';
import type { Card, PublicGameState, Rank } from '../../src/contracts/types';
import { createDealTracker, dealBoundaries, dealKey, dealPhaseNow } from '../../src/game/deal';
import {
  MANILHA_REVEAL,
  isManilha,
  manilhaReveals,
  revealMoments,
  revealProgress,
  showsManilha,
} from '../../src/game/manilha';

const c = (rank: Rank, suit: Card['suit']): Card => ({ rank, suit });
const run = { startedAt: 10_000, intro: false };
const viraOpen = run.startedAt + dealBoundaries(false).done;

describe('quais cartas são manilha', () => {
  it('segue a vira do motor (vira 7 → manilha Q), sem valor fixo', () => {
    const rank = manilhaRankFor(c('7', 'copas'));
    expect(rank).toBe('Q');
    expect(isManilha(c('Q', 'paus'), rank)).toBe(true);
    expect(isManilha(c('7', 'paus'), rank)).toBe(false);
    // Vira 3 dá a volta: manilha 4.
    expect(isManilha(c('4', 'ouros'), manilhaRankFor(c('3', 'espadas')))).toBe(true);
  });
});

describe('revelação ao receber manilha', () => {
  it('mão sem manilha não revela nada', () => {
    expect(manilhaReveals(run, [c('4', 'ouros'), c('5', 'copas'), c('A', 'paus')], 'K')).toEqual([]);
  });

  it('uma manilha: uma revelação, depois de a vira abrir', () => {
    const reveals = manilhaReveals(run, [c('4', 'ouros'), c('K', 'copas'), c('A', 'paus')], 'K');
    expect(reveals).toHaveLength(1);
    expect(reveals[0].key).toBe('K_copas');
    expect(reveals[0].startsAt).toBeGreaterThanOrEqual(viraOpen);
    expect(reveals[0].endsAt - reveals[0].startsAt).toBe(MANILHA_REVEAL.duration);
  });

  it('duas e três manilhas: escalonadas da esquerda para a direita, picos separados', () => {
    const two = manilhaReveals(run, [c('K', 'paus'), c('4', 'ouros'), c('K', 'ouros')], 'K');
    expect(two.map((r) => r.key)).toEqual(['K_paus', 'K_ouros']);
    expect(two[1].startsAt - two[0].startsAt).toBe(MANILHA_REVEAL.stagger);

    const three = manilhaReveals(run, [c('K', 'paus'), c('K', 'copas'), c('K', 'ouros')], 'K');
    expect(three).toHaveLength(3);
    const starts = three.map((r) => r.startsAt);
    expect(starts).toEqual([...starts].sort((a, b) => a - b));
    // A sequência inteira cabe em pouco mais de 3 s depois da vira, e o jogo não espera por ela.
    expect(three[2].endsAt - viraOpen).toBeLessThan(3500);
  });

  it('sem distribuição animada neste aparelho (reconexão, mão em andamento) não revela', () => {
    expect(manilhaReveals(null, [c('K', 'paus')], 'K')).toEqual([]);
  });

  it('render repetido, nova sincronização e remontagem não repetem: o horário é o da distribuição', () => {
    const tracker = createDealTracker();
    const state: PublicGameState = newMatch(seededRng(3)).public;
    const first = tracker.start(dealKey('m', 1), state, 1000);
    const again = tracker.start(dealKey('m', 1), state, 60_000);
    const hand = [c(state.manilhaRank, 'paus')];
    expect(manilhaReveals(again, hand, state.manilhaRank)).toEqual(manilhaReveals(first, hand, state.manilhaRank));
    // Voltando à tela depois do fim, o efeito já passou: nada é montado.
    const [reveal] = manilhaReveals(again, hand, state.manilhaRank);
    expect(revealProgress(reveal, reveal.endsAt + 5000)).toBeNull();
  });

  it('progresso: null antes e depois, 0 a 1 durante (retoma do ponto ao remontar)', () => {
    const [reveal] = manilhaReveals(run, [c('K', 'paus')], 'K');
    expect(revealProgress(reveal, reveal.startsAt - 1)).toBeNull();
    expect(revealProgress(reveal, reveal.startsAt)).toBe(0);
    expect(revealProgress(reveal, reveal.startsAt + MANILHA_REVEAL.duration / 2)).toBeCloseTo(0.5);
    expect(revealProgress(reveal, reveal.endsAt)).toBeNull();
    expect(revealProgress(undefined, reveal.startsAt)).toBeNull();
  });

  it('redesenha só no início e no fim de cada revelação', () => {
    const reveals = manilhaReveals(run, [c('K', 'paus'), c('K', 'copas')], 'K');
    expect(revealMoments(reveals)).toEqual([reveals[0].startsAt, reveals[0].endsAt, reveals[1].startsAt, reveals[1].endsAt]);
  });
});

describe('destaque dourado permanente', () => {
  const manilha = c('K', 'paus');

  it('não aparece antes de a vira abrir', () => {
    for (const now of [run.startedAt, viraOpen - 1]) {
      expect(showsManilha(manilha, 'K', dealPhaseNow(run, now), undefined, now)).toBe(false);
    }
  });

  it('com revelação, acende quando ela começa e fica depois do fim', () => {
    const [reveal] = manilhaReveals(run, [manilha], 'K');
    expect(showsManilha(manilha, 'K', 'done', reveal, reveal.startsAt - 1)).toBe(false);
    expect(showsManilha(manilha, 'K', 'done', reveal, reveal.startsAt)).toBe(true);
    expect(showsManilha(manilha, 'K', 'done', reveal, reveal.endsAt + 60_000)).toBe(true);
  });

  it('sem animação, aparece direto; carta comum nunca', () => {
    expect(showsManilha(manilha, 'K', 'done', undefined, 0)).toBe(true);
    expect(showsManilha(c('4', 'paus'), 'K', 'done', undefined, 0)).toBe(false);
  });

  it('acompanha a vira: a mesma carta deixa de ser manilha na mão seguinte', () => {
    expect(showsManilha(manilha, 'K', 'done', undefined, 0)).toBe(true);
    expect(showsManilha(manilha, 'A', 'done', undefined, 0)).toBe(false);
  });
});
