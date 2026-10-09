// Avisos de truco: o que anunciar, quando, e se o desenho cabe no espaço da mesa.
import { describe, expect, it } from 'vitest';
import { applyAction, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { MatchState } from '../../supabase/functions/_shared/engine/index.ts';
import type { GameAction, PublicGameState, Seat } from '../../src/contracts/types';
import { calloutLayout, textBlockHeight } from '../../src/game/calloutLayout';
import { cueDuration, eventCue, MAX_REVISION_GAP, shouldAnnounce, trucoTier, type TableCue } from '../../src/game/cue';
import { activeTurnSeat, initials, seatSummaries, shortName, trucoName } from '../../src/game/describe';
import { tableGeometry } from '../../src/game/geometry';
import { statusSubline, statusText } from '../../src/game/status';
import { surfaceMetrics } from '../../src/ui/shapes';

/** Simula o servidor: aplica a ação e devolve o estado público com `lastEvent`, como o app recebe. */
function act(state: MatchState, seat: Seat, action: GameAction): MatchState {
  const result = applyAction(state, seat, action, seededRng(99));
  if (!result.ok) throw new Error(`ação recusada: ${result.error}`);
  return result.state;
}

describe('avisos acompanham a disputa de truco real (motor)', () => {
  it('truco → seis → nove → doze → aceito: um aviso por ação, na ordem, com o valor confirmado', () => {
    let state = newMatch(seededRng(3));
    const cues: (TableCue | null)[] = [];
    const opener = state.public.currentTurnSeat;
    const other = ((opener % 4) + 1) as Seat;

    state = act(state, opener, { type: 'request_truco' });
    cues.push(eventCue(state.public.lastEvent, state.public));
    state = act(state, other, { type: 'respond_truco', response: 'raise' });
    cues.push(eventCue(state.public.lastEvent, state.public));
    state = act(state, opener, { type: 'respond_truco', response: 'raise' });
    cues.push(eventCue(state.public.lastEvent, state.public));
    state = act(state, other, { type: 'respond_truco', response: 'raise' });
    cues.push(eventCue(state.public.lastEvent, state.public));
    state = act(state, opener, { type: 'respond_truco', response: 'accept' });
    cues.push(eventCue(state.public.lastEvent, state.public));

    expect(cues).toEqual([
      { kind: 'call', seat: opener, value: 3, raise: false },
      { kind: 'call', seat: other, value: 6, raise: true },
      { kind: 'call', seat: opener, value: 9, raise: true },
      { kind: 'call', seat: other, value: 12, raise: true },
      { kind: 'accept', seat: opener, value: 12 },
    ]);
    // O aceite só aparece depois que o estado confirma o novo valor.
    expect(state.public.handValue).toBe(12);
    expect(state.public.truco).toBeNull();
  });

  it('correr do pedido vira fala ("Corro!"), não aviso de aceite', () => {
    let state = newMatch(seededRng(5));
    const opener = state.public.currentTurnSeat;
    state = act(state, opener, { type: 'request_truco' });
    state = act(state, ((opener % 4) + 1) as Seat, { type: 'respond_truco', response: 'refuse' });
    expect(eventCue(state.public.lastEvent, state.public)).toMatchObject({ kind: 'speech', text: 'Corro!' });
  });

  it('jogar carta não gera aviso (e encerra o aviso anterior na tela)', () => {
    let state = newMatch(seededRng(8));
    const seat = state.public.currentTurnSeat;
    state = act(state, seat, { type: 'play_card', card: state.hands[seat - 1][0] });
    expect(eventCue(state.public.lastEvent, state.public)).toBeNull();
  });
});

describe('quando anunciar (sincronização no multiplayer)', () => {
  it('primeira leitura da tela (abrir, remontar, reconectar) não repete aviso antigo', () => {
    expect(shouldAnnounce(null, 12, false)).toBe(false);
  });

  it('revisão nova anuncia uma vez; a mesma revisão ou uma mais antiga, nunca', () => {
    expect(shouldAnnounce(4, 5, false)).toBe(true);
    expect(shouldAnnounce(5, 5, false)).toBe(false);
    expect(shouldAnnounce(5, 4, false)).toBe(false);
  });

  it('leituras juntas (duas ou três revisões de uma vez) ainda anunciam o último evento', () => {
    expect(shouldAnnounce(4, 4 + MAX_REVISION_GAP, false)).toBe(true);
  });

  it('salto grande (app voltou do segundo plano) ou queda de conexão não anunciam evento velho', () => {
    expect(shouldAnnounce(4, 5 + MAX_REVISION_GAP, false)).toBe(false);
    expect(shouldAnnounce(4, 5, true)).toBe(false);
  });

  it('duração do aviso é curta e só de apresentação', () => {
    const call = cueDuration({ kind: 'call', seat: 1, value: 6, raise: false });
    const accept = cueDuration({ kind: 'accept', seat: 2, value: 6 });
    expect(call).toBeGreaterThan(1500);
    expect(call).toBeLessThanOrEqual(3000);
    expect(accept).toBeGreaterThan(1500);
    expect(accept).toBeLessThanOrEqual(3000);
  });

  it('degraus da aposta: 3, 6, 9 e 12 em ordem', () => {
    expect([3, 6, 9, 12].map(trucoTier)).toEqual([0, 1, 2, 3]);
    expect([3, 6, 9, 12].map(trucoName)).toEqual(['TRUCO', 'SEIS', 'NOVE', 'DOZE']);
  });
});

describe('aviso de truco cabe no palco da mesa', () => {
  const sizes = [
    [344, 250, 'compact'],
    [395, 330, 'compact'],
    [412, 420, 'compact'],
    [320, 380, 'large'],
    [395, 560, 'large'],
    [760, 820, 'large'],
  ] as const;

  it.each(sizes)('%s x %s (%s): medalhão e textos dentro da plaquinha, plaquinha dentro do palco', (w, h, variant) => {
    const m = surfaceMetrics(w, h, variant === 'large' ? 'table' : 'compact');
    const g = tableGeometry(m.content.w, m.content.h, variant, m.n);
    for (const title of ['TRUCO!', 'SEIS!', 'NOVE!', 'DOZE!', 'ACEITO!']) {
      const lay = calloutLayout(g.stage.w, g.stage.h, title, variant === 'large');
      expect(lay.plaque.w).toBeLessThanOrEqual(g.stage.w + 0.01);
      expect(lay.plaque.h).toBeLessThanOrEqual(g.stage.h + 0.01);
      const inner = lay.plaque.h - 2 * lay.pad;
      const text = textBlockHeight(lay.titleSize, lay.kickerSize, lay.ladder);
      if (lay.row) {
        expect(lay.medal).toBeLessThanOrEqual(inner + 0.01);
        expect(text).toBeLessThanOrEqual(inner + 0.01);
      } else {
        expect(lay.medal + (lay.medal ? 3 : 0) + text).toBeLessThanOrEqual(inner + 0.01);
      }
      // Título legível; medalhão, quando aparece, grande o bastante para o número.
      expect(lay.titleSize).toBeGreaterThanOrEqual(12);
      if (lay.medal) expect(lay.medal).toBeGreaterThanOrEqual(30);
    }
  });

  it('com espaço, o aviso mostra medalhão, quem pediu e a escada da aposta', () => {
    const lay = calloutLayout(353, 168, 'SEIS!', true);
    expect(lay.row).toBe(true);
    expect(lay.medal).toBeGreaterThan(60);
    expect(lay.kickerSize).not.toBeNull();
    expect(lay.ladder).not.toBeNull();
  });
});

describe('identificação dos jogadores', () => {
  it('iniciais do avatar', () => {
    expect(initials('Bia')).toBe('B');
    expect(initials('maria eduarda')).toBe('ME');
    expect(initials('  Ana Carolina  Albuquerque ')).toBe('AA');
    expect(initials('Élio')).toBe('É');
    expect(initials('')).toBe('?');
  });

  it('primeiro nome para frases curtas', () => {
    expect(shortName('Bianca Mendonça')).toBe('Bianca');
    expect(shortName('Você')).toBe('Você');
  });

  it('vez: ninguém destacado com truco pendente, na distribuição ou com a partida encerrada', () => {
    const state = newMatch(seededRng(1)).public;
    expect(activeTurnSeat(state, false)).toBe(state.currentTurnSeat);
    expect(activeTurnSeat(state, true)).toBeNull();
    const truco: PublicGameState = { ...state, truco: { value: 3, requestedBy: 'A', requestedBySeat: 1 } };
    expect(activeTurnSeat(truco, false)).toBeNull();
    expect(activeTurnSeat({ ...state, status: 'finished' }, false)).toBeNull();
    // O painel do jogador segue a mesma regra que a mesa.
    expect(seatSummaries(truco, 1, (s) => `P${s}`, false).some((s) => s.isTurn)).toBe(false);
  });

  it('status com nome longo: frase curta com o primeiro nome e complemento na segunda linha', () => {
    const state = newMatch(seededRng(1)).public;
    const truco: PublicGameState = { ...state, truco: { value: 9, requestedBy: 'B', requestedBySeat: 2 } };
    const status = statusText({ state: truco, viewerSeat: null, nameOf: () => 'Bianca Mendonça', canRespond: false, phase: 'done' })!;
    expect(status.main).toBe('Bianca pediu NOVE!');
    expect(statusSubline(status)).toBe('Dupla A responde');
  });
});
