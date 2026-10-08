import { describe, expect, it } from 'vitest';
import { getLegalActions, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import { parseAction } from '../../supabase/functions/_shared/match-service.ts';
import type { MatchView, PublicGameState, Seat } from '../../src/contracts/types';
import { trucoControls } from '../../src/game/controls';
import { describeHand, describeTrick, eventBubble, teamLabel } from '../../src/game/describe';
import { hasOverlap, tableGeometry } from '../../src/game/geometry';
import { resolveRole } from '../../src/game/role';
import { statusText } from '../../src/game/status';

const base = (): PublicGameState => newMatch(seededRng(1)).public;
const names: Record<Seat, string> = { 1: 'Ana', 2: 'Bia', 3: 'Caio', 4: 'Duda' };
const nameOf = (seat: Seat) => names[seat];

describe('geometria da mesa', () => {
  it.each([
    ['celular pequeno, metade de cima', 344, 250, 'compact'],
    ['celular comum, metade de cima', 395, 330, 'compact'],
    ['celular grande, metade de cima', 412, 420, 'compact'],
    ['mesa dedicada', 395, 560, 'large'],
    ['mesa dedicada em tablet', 760, 820, 'large'],
  ] as const)('%s: lugares, cartas, baralho e vira não se sobrepõem', (_, w, h, variant) => {
    const g = tableGeometry(w, h, variant);
    expect(hasOverlap(g)).toBe(false);
    // Carta legível mesmo no celular pequeno.
    expect(g.card.w).toBeGreaterThanOrEqual(40);
    // Tudo dentro da área.
    for (const r of [...Object.values(g.chips), ...Object.values(g.played), g.deck, g.vira]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(w + 0.001);
      expect(r.y + r.h).toBeLessThanOrEqual(h + 0.001);
    }
  });

  it('a mesa dedicada usa cartas maiores que a metade de cima do jogador', () => {
    expect(tableGeometry(395, 560, 'large').card.w).toBeGreaterThan(tableGeometry(395, 330, 'compact').card.w);
  });
});

describe('controles de truco', () => {
  it('na própria vez, sem pedido: pedir truco e correr (com confirmação)', () => {
    const state = base();
    const { mode, controls } = trucoControls(state, getLegalActions(state, state.currentTurnSeat));
    expect(mode).toBe('play');
    expect(controls.map((c) => [c.label, c.confirm])).toEqual([
      ['Pedir TRUCO', false],
      ['Correr', true],
    ]);
  });

  it('fora da vez não pede truco, mas pode correr', () => {
    const state = base();
    const other = ((state.currentTurnSeat % 4) + 1) as Seat;
    expect(trucoControls(state, getLegalActions(state, other)).controls.map((c) => c.id)).toEqual(['fold']);
  });

  it('com pedido pendente: a dupla adversária aceita, corre ou pede seis; a que pediu só aguarda', () => {
    const state: PublicGameState = { ...base(), truco: { value: 3, requestedBy: 'A', requestedBySeat: 1 } };
    const answer = trucoControls(state, getLegalActions(state, 2));
    expect(answer.mode).toBe('respond');
    expect(answer.controls.map((c) => c.label)).toEqual(['Aceitar', 'Correr', 'Pedir SEIS']);
    expect(trucoControls(state, getLegalActions(state, 3))).toEqual({ mode: 'waiting_answer', controls: [] });
  });

  it('pedido de doze não pode ser aumentado', () => {
    const state: PublicGameState = { ...base(), handValue: 9, truco: { value: 12, requestedBy: 'B', requestedBySeat: 2 } };
    expect(trucoControls(state, getLegalActions(state, 1)).controls.map((c) => c.id)).toEqual(['accept', 'refuse']);
  });

  it('depois de aceitar seis, só quem aceitou pode pedir nove', () => {
    const state: PublicGameState = { ...base(), handValue: 6, raiseRight: 'B', currentTurnSeat: 2 };
    expect(trucoControls(state, getLegalActions(state, 2)).controls[0].label).toBe('Pedir NOVE');
    const turnA: PublicGameState = { ...state, currentTurnSeat: 1 };
    expect(trucoControls(turnA, getLegalActions(turnA, 1)).controls.map((c) => c.id)).toEqual(['fold']);
  });

  it('mão de 11 não tem truco', () => {
    const state: PublicGameState = { ...base(), maoDeOnze: 'A', handValue: 3 };
    expect(trucoControls(state, getLegalActions(state, state.currentTurnSeat)).controls.map((c) => c.id)).toEqual(['fold']);
  });
});

describe('textos da mesa central (visão neutra)', () => {
  it('fala em Dupla A e Dupla B, nunca em "nós"', () => {
    expect(teamLabel('A', null)).toBe('Dupla A');
    expect(describeTrick('B', null)).toBe('Vaza da dupla B');
    expect(describeHand({ winner: 'A', points: 3, reason: 'refused' }, null)).toBe('Dupla B correu do truco (+3 pontos para a dupla A)');
    expect(describeHand({ winner: 'A', points: 1, reason: 'fold' }, null)).toBe('Dupla B correu (+1 ponto para a dupla A)');
    expect(describeHand({ winner: 'B', points: 1, reason: 'tricks' }, null)).toBe('Dupla B ganhou a mão (+1 ponto)');
  });

  it('status: vez, truco e distribuição', () => {
    const state = base();
    const turn = state.currentTurnSeat;
    expect(statusText({ state, viewerSeat: null, nameOf, canRespond: false, phase: 'done' })?.main).toBe(`Vez de ${names[turn]}`);
    expect(statusText({ state, viewerSeat: turn, nameOf, canRespond: false, phase: 'done' })).toMatchObject({
      main: 'Sua vez! Escolha uma carta.',
      tone: 'turn',
    });
    expect(statusText({ state, viewerSeat: turn, nameOf, canRespond: false, phase: 'dealing' })?.main).toBe('Distribuindo as cartas…');

    const truco: PublicGameState = { ...state, truco: { value: 6, requestedBy: 'B', requestedBySeat: 4 } };
    expect(statusText({ state: truco, viewerSeat: null, nameOf, canRespond: false, phase: 'done' })).toMatchObject({
      main: 'Duda pediu SEIS! Dupla A responde.',
      tone: 'truco',
    });
    expect(statusText({ state: truco, viewerSeat: 1, nameOf, canRespond: true, phase: 'done' })?.main).toBe('Duda pediu SEIS! Responda abaixo.');
    expect(statusText({ state: { ...state, status: 'finished' }, viewerSeat: 1, nameOf, canRespond: false, phase: 'done' })).toBeNull();
  });

  it('falas curtas de truco, aceite e correr; carta jogada não tem fala', () => {
    const state = base();
    const pending: PublicGameState = { ...state, truco: { value: 3, requestedBy: 'A', requestedBySeat: 1 } };
    expect(eventBubble({ seat: 1, action: 'request_truco' }, pending)).toBe('TRUCO!');
    expect(eventBubble({ seat: 2, action: 'respond_truco', response: 'accept' }, state)).toBe('Aceito!');
    expect(eventBubble({ seat: 2, action: 'respond_truco', response: 'refuse' }, state)).toBe('Corro!');
    expect(eventBubble({ seat: 2, action: 'respond_truco', response: 'raise' }, { ...state, truco: { value: 6, requestedBy: 'B', requestedBySeat: 2 } })).toBe('SEIS!');
    expect(eventBubble({ seat: 3, action: 'play_card', card: { rank: '4', suit: 'ouros' } }, state)).toBeNull();
    expect(eventBubble(undefined, state)).toBeNull();
  });
});

describe('papel do aparelho na partida', () => {
  const match = (tableUserId: string | null): MatchView => ({
    matchId: 'm',
    roomId: 'r',
    roomCode: 'ABCDEF',
    revision: 0,
    state: base(),
    tableUserId,
  });
  const players = [1, 2, 3, 4].map((seat) => ({ seat: seat as Seat, team: seat % 2 ? 'A' : 'B', userId: `u${seat}`, displayName: `P${seat}` })) as any;

  it('jogador da partida joga; a mesa registrada só assiste; o resto não vê', () => {
    expect(resolveRole('u2', match('mesa'), players, null)).toBe('player');
    expect(resolveRole('mesa', match('mesa'), players, null)).toBe('table');
    expect(resolveRole('mesa', match(null), players, null)).toBeNull();
    expect(resolveRole(null, match(null), players, null)).toBeNull();
  });
});

describe('validação do formato das ações no servidor', () => {
  it('aceita só formatos conhecidos e copia só os campos esperados', () => {
    expect(parseAction({ type: 'play_card', card: { rank: 'A', suit: 'paus', extra: 1 } })).toEqual({
      type: 'play_card',
      card: { rank: 'A', suit: 'paus' },
    });
    expect(parseAction({ type: 'respond_truco', response: 'raise' })).toEqual({ type: 'respond_truco', response: 'raise' });
    expect(parseAction({ type: 'play_card', card: { rank: '8', suit: 'paus' } })).toBeNull();
    expect(parseAction({ type: 'respond_truco', response: 'talvez' })).toBeNull();
    expect(parseAction({ type: 'set_score', score: 12 })).toBeNull();
    expect(parseAction(null)).toBeNull();
  });
});
