// Prazo no aparelho, gesto de jogada automática e junção da marcação na mão.
import { describe, expect, it } from 'vitest';
import { getLegalActions, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { ActionDeadline, Card, PrivateHand } from '../../src/contracts/types';
import { AUTO_DRAG_MIN, autoDragThreshold, canArmAuto, startsAutoDrag } from '../../src/game/autoPlay';
import {
  ACTION_TIMEOUT_MS,
  EXPIRE_GRACE_MS,
  EXPIRE_STAGGER_MS,
  clockOffset,
  expireActionId,
  expireDelay,
  hasStarted,
  isMine,
  remainingMs,
  secondsLeft,
  tickMoments,
} from '../../src/game/deadline';
import { EMPTY_MATCH_DATA, mergeMatchData, withAutoCard, type MatchData } from '../../src/game/matchData';
import { playedCardKey } from '../../src/game/describe';

const AT = 2_000_000;
const play: ActionDeadline = { kind: 'play', seat: 2, team: null, startsAt: AT - ACTION_TIMEOUT_MS, at: AT };
const truco: ActionDeadline = { kind: 'truco', seat: null, team: 'A', startsAt: AT - ACTION_TIMEOUT_MS, at: AT };

describe('contagem do prazo', () => {
  it('converte pelo relógio do servidor (offset) e limita a 0..20 s', () => {
    // Aparelho 1 s atrasado em relação ao servidor.
    expect(remainingMs(play, AT - 6000, 1000)).toBe(5000);
    expect(remainingMs(play, AT + 5000, 0)).toBe(0);
    expect(remainingMs(play, AT - 60_000, 0)).toBe(ACTION_TIMEOUT_MS);
    expect(hasStarted(play, play.startsAt - 1, 0)).toBe(false);
    expect(hasStarted(play, play.startsAt, 0)).toBe(true);
  });

  it('o número só chega a 0 no fim, e muda nos instantes de tickMoments', () => {
    expect(secondsLeft(20_000)).toBe(20);
    expect(secondsLeft(19_001)).toBe(20);
    expect(secondsLeft(19_000)).toBe(19);
    expect(secondsLeft(1)).toBe(1);
    expect(secondsLeft(0)).toBe(0);
    const moments = tickMoments(play, 500);
    expect(moments).toHaveLength(21);
    expect(moments[0]).toBe(play.startsAt - 500);
    expect(moments[moments.length - 1]).toBe(AT - 500);
    for (const m of moments.slice(1)) expect(secondsLeft(remainingMs(play, m, 500)) * 1000).toBe(AT - (m + 500));
  });

  it('de quem é o prazo: jogar é do lugar; truco é da dupla que responde', () => {
    expect(isMine(play, 2)).toBe(true);
    expect(isMine(play, 4)).toBe(false);
    expect(isMine(truco, 1)).toBe(true);
    expect(isMine(truco, 3)).toBe(true);
    expect(isMine(truco, 2)).toBe(false);
  });

  it('expiração: o lugar 1 primeiro, os outros escalonados, nunca antes do fim', () => {
    expect(expireDelay(play, AT, 0, 1)).toBe(EXPIRE_GRACE_MS);
    expect(expireDelay(play, AT, 0, 3)).toBe(EXPIRE_GRACE_MS + 2 * EXPIRE_STAGGER_MS);
    expect(expireDelay(play, AT - 10_000, 0, 1)).toBe(10_000 + EXPIRE_GRACE_MS);
    expect(expireDelay(play, AT + 60_000, 0, 4)).toBe(0);
    expect(expireActionId(play, 3)).toBe(`expire-${AT}-3`);
  });

  it('diferença de relógio pela metade da ida e volta', () => {
    expect(clockOffset(1000, 1200, 5100)).toBe(4000);
  });
});

describe('gesto de jogada automática', () => {
  it('limite proporcional à carta, com mínimo para cartas pequenas', () => {
    expect(autoDragThreshold(200)).toBe(120);
    expect(autoDragThreshold(60)).toBe(AUTO_DRAG_MIN);
  });

  it('só captura movimento vertical para cima', () => {
    expect(startsAutoDrag(0, -20)).toBe(true);
    expect(startsAutoDrag(0, -5)).toBe(false);
    expect(startsAutoDrag(0, 30)).toBe(false);
    expect(startsAutoDrag(25, -20)).toBe(false);
  });

  it('na própria vez com jogada livre não marca (vale a jogada normal)', () => {
    const state = newMatch(seededRng(3), 0).public;
    const turn = state.currentTurnSeat;
    const other = ((turn % 4) + 1) as 1 | 2 | 3 | 4;
    expect(canArmAuto(state, getLegalActions(state, turn), false)).toBe(false);
    expect(canArmAuto(state, getLegalActions(state, other), false)).toBe(true);
    expect(canArmAuto(state, getLegalActions(state, other), true)).toBe(false);
  });
});

describe('marcação na mão do aparelho', () => {
  const card: Card = { rank: '7', suit: 'copas' };
  const hand: PrivateHand = { revision: 3, seat: 2, cards: [card], covered: null, autoCard: null };
  const data: MatchData = { ...EMPTY_MATCH_DATA, hand, loaded: true, role: 'player' };

  it('aplica a marcação confirmada e reaproveita o objeto quando nada muda', () => {
    const marked = withAutoCard(data, card);
    expect(marked.hand!.autoCard).toEqual(card);
    expect(withAutoCard(marked, { ...card })).toBe(marked);
    expect(withAutoCard(EMPTY_MATCH_DATA, card)).toBe(EMPTY_MATCH_DATA);
  });

  it('leitura da mesma revisão com marcação diferente substitui a mão', () => {
    const match = { matchId: 'm', roomId: 'r', roomCode: null, revision: 3, state: newMatch(seededRng(1), 0).public, tableUserId: null };
    const players = [{ seat: 2 as const, team: 'B' as const, userId: 'u', displayName: 'Bia' }];
    const first = mergeMatchData(EMPTY_MATCH_DATA, { match, players, hand }, 'u');
    const same = mergeMatchData(first, { match, players, hand: { ...hand } }, 'u');
    expect(same).toBe(first);
    const changed = mergeMatchData(first, { match, players, hand: { ...hand, autoCard: card } }, 'u');
    expect(changed.hand!.autoCard).toEqual(card);
  });
});

describe('identidade da carta escondida na mesa', () => {
  it('mesma chave escondida e revelada na mesma vaza; outra vaza, outra chave', () => {
    const card: Card = { rank: '3', suit: 'paus' };
    expect(playedCardKey({ seat: 2, card: null, hidden: true }, 1)).toBe(playedCardKey({ seat: 2, card, hidden: true }, 1));
    expect(playedCardKey({ seat: 2, card: null, hidden: true }, 2)).not.toBe(playedCardKey({ seat: 2, card, hidden: true }, 1));
    expect(playedCardKey({ seat: 2, card })).toBe('3_paus');
  });
});
