// Tela do jogador com mesa dedicada: o que cada aparelho mostra.
import { describe, expect, it } from 'vitest';
import { applyAction, getLegalActions, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { MatchState } from '../../supabase/functions/_shared/engine/index.ts';
import type { Seat, TableCard } from '../../src/contracts/types';
import { playedCardKey, seatSummaries } from '../../src/game/describe';
import { playerLayout } from '../../src/game/role';

const names: Record<Seat, string> = { 1: 'Ana', 2: 'Bia', 3: 'Caio', 4: 'Duda' };
const nameOf = (seat: Seat) => names[seat];

/** Joga a primeira carta legal de quem está na vez. */
function playOne(state: MatchState, rng: () => number): MatchState {
  const seat = state.public.currentTurnSeat;
  const result = applyAction(state, seat, { type: 'play_card', card: state.hands[seat - 1][0] }, rng);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('qual tela o jogador vê', () => {
  it('sem mesa dedicada: mesa em cima e mão embaixo; com mesa dedicada: só a mão e o essencial', () => {
    expect(playerLayout({ tableUserId: null })).toBe('split');
    expect(playerLayout({ tableUserId: 'mesa' })).toBe('hand');
  });
});

describe('resumo público dos lugares (tela do jogador com mesa dedicada)', () => {
  it('começa por quem olha, segue a ordem da mesa e marca a vez', () => {
    const state = newMatch(seededRng(2)).public;
    const seats = seatSummaries(state, 3, nameOf, false);
    expect(seats.map((s) => s.seat)).toEqual([3, 4, 1, 2]);
    expect(seats.filter((s) => s.isTurn).map((s) => s.seat)).toEqual([state.currentTurnSeat]);
    expect(seatSummaries(state, 3, nameOf, true).some((s) => s.isTurn)).toBe(false);
  });

  it('não carrega carta nenhuma: nem de mão, nem jogada (as jogadas ficam na mesa central)', () => {
    const rng = seededRng(5);
    let game = newMatch(rng);
    game = playOne(game, rng);
    game = playOne(game, rng);
    const seats = seatSummaries(game.public, 1, nameOf, false);

    const text = JSON.stringify(seats);
    for (const card of [...game.hands.flat(), ...game.public.tableCards.map((c) => c.card)]) {
      expect(text).not.toContain(`"rank":"${card.rank}","suit":"${card.suit}"`);
    }
    expect(Object.keys(seats[0]).sort()).toEqual(['cardsLeft', 'isTurn', 'name', 'played', 'seat', 'team']);
    // Quem já jogou nesta vaza aparece marcado, com uma carta a menos.
    const played = game.public.tableCards.map((c) => c.seat);
    for (const s of seats) {
      expect(s.played).toBe(played.includes(s.seat));
      expect(s.cardsLeft).toBe(played.includes(s.seat) ? 2 : 3);
    }
  });
});

describe('cartas na mesa sem piscar quando a vaza fecha', () => {
  it('a mesma carta tem a mesma identidade na mesa e na última vaza', () => {
    const rng = seededRng(11);
    let game = newMatch(rng);
    const onTable: TableCard[] = [];
    for (let i = 0; i < 3; i++) {
      game = playOne(game, rng);
      onTable.push(game.public.tableCards[game.public.tableCards.length - 1]);
    }
    expect(getLegalActions(game.public, game.public.currentTurnSeat).playCard).toBe(true);
    game = playOne(game, rng);

    // Vaza fechada: a mesa limpa e as 4 cartas passam para lastTrick.
    expect(game.public.tableCards).toEqual([]);
    const lastKeys = game.public.lastTrick!.cards.map(playedCardKey);
    for (const card of onTable) expect(lastKeys).toContain(playedCardKey(card));
    expect(new Set(lastKeys).size).toBe(4);
  });
});
