import { describe, expect, it } from 'vitest';
import {
  cardStrength,
  createDeck,
  deal,
  manilhaRankFor,
  nextSeat,
  RANKS,
  resolveTrick,
  seededRng,
  SUITS,
  teamOf,
} from '../../supabase/functions/_shared/engine/index.ts';
import type { Card, Rank, Suit, TableCard } from '../../supabase/functions/_shared/engine/index.ts';

const c = (rank: Rank, suit: Suit): Card => ({ rank, suit });
const key = (card: Card) => `${card.rank}_${card.suit}`;

describe('baralho', () => {
  it('tem 40 cartas únicas, sem 8, 9 e 10', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(40);
    expect(new Set(deck.map(key)).size).toBe(40);
    expect(deck.some((card) => ['8', '9', '10'].includes(card.rank))).toBe(false);
  });

  it('distribui 12 cartas sem repetição e uma vira diferente delas', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { hands, vira } = deal(seededRng(seed));
      expect(hands).toHaveLength(4);
      hands.forEach((hand) => expect(hand).toHaveLength(3));
      const all = [...hands.flat(), vira].map(key);
      expect(new Set(all).size).toBe(13);
    }
  });

  it('a mesma semente gera a mesma distribuição', () => {
    expect(deal(seededRng(7))).toEqual(deal(seededRng(7)));
    expect(deal(seededRng(7))).not.toEqual(deal(seededRng(8)));
  });
});

describe('assentos e duplas', () => {
  it('1 e 3 são a dupla A; 2 e 4 são a dupla B', () => {
    expect([1, 2, 3, 4].map((s) => teamOf(s as 1 | 2 | 3 | 4))).toEqual(['A', 'B', 'A', 'B']);
  });

  it('a vez gira 1 > 2 > 3 > 4 > 1', () => {
    expect([nextSeat(1), nextSeat(2), nextSeat(3), nextSeat(4)]).toEqual([2, 3, 4, 1]);
  });
});

describe('manilha', () => {
  it.each([
    ['4', '5'],
    ['7', 'Q'],
    ['Q', 'J'],
    ['K', 'A'],
    ['A', '2'],
    ['2', '3'],
    ['3', '4'],
  ] as [Rank, Rank][])('vira %s gera manilha %s', (vira, manilha) => {
    expect(manilhaRankFor(c(vira, 'copas'))).toBe(manilha);
  });

  it('toda manilha vence toda carta comum', () => {
    for (const vira of RANKS) {
      const manilha = manilhaRankFor(c(vira, 'ouros'));
      const weakestManilha = cardStrength(c(manilha, 'ouros'), manilha);
      for (const rank of RANKS.filter((r) => r !== manilha)) {
        for (const suit of SUITS) {
          expect(cardStrength(c(rank, suit), manilha)).toBeLessThan(weakestManilha);
        }
      }
    }
  });

  it('entre manilhas vale ouros < espadas < copas < paus', () => {
    const strengths = SUITS.map((suit) => cardStrength(c('4', suit), '4'));
    expect([...strengths].sort((a, b) => a - b)).toEqual(strengths);
    expect(new Set(strengths).size).toBe(4);
  });

  it('cartas comuns seguem 4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3', () => {
    // Com vira 3 a manilha é o 4, então as outras nove ficam na ordem comum.
    const commons = RANKS.filter((r) => r !== '4').map((rank) => cardStrength(c(rank, 'paus'), '4'));
    for (let i = 1; i < commons.length; i++) expect(commons[i]).toBeGreaterThan(commons[i - 1]);
  });
});

describe('vaza', () => {
  const table = (...cards: [1 | 2 | 3 | 4, Card][]): TableCard[] => cards.map(([seat, card]) => ({ seat, card }));

  it('a carta mais forte vence e abre a próxima vaza', () => {
    const result = resolveTrick(table([1, c('K', 'ouros')], [2, c('3', 'ouros')], [3, c('5', 'copas')], [4, c('7', 'paus')]), '4');
    expect(result).toEqual({ result: 'B', leadSeat: 2 });
  });

  it('manilha vence o 3', () => {
    const result = resolveTrick(table([1, c('3', 'paus')], [2, c('4', 'ouros')], [3, c('2', 'copas')], [4, c('A', 'paus')]), '4');
    expect(result.result).toBe('B');
  });

  it('cartas iguais de duplas diferentes empatam; abre quem jogou primeiro a mais forte', () => {
    const result = resolveTrick(table([1, c('5', 'ouros')], [2, c('3', 'ouros')], [3, c('3', 'paus')], [4, c('6', 'copas')]), '4');
    expect(result).toEqual({ result: 'tie', leadSeat: 2 });
  });

  it('cartas iguais da mesma dupla não empatam', () => {
    const result = resolveTrick(table([1, c('3', 'ouros')], [2, c('2', 'ouros')], [3, c('3', 'copas')], [4, c('A', 'paus')]), '4');
    expect(result).toEqual({ result: 'A', leadSeat: 1 });
  });
});
