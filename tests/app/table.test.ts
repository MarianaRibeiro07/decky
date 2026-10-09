import { describe, expect, it } from 'vitest';
import { getLegalActions, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import { parseAction } from '../../supabase/functions/_shared/match-service.ts';
import type { MatchView, PublicGameState, Seat } from '../../src/contracts/types';
import { trucoControls } from '../../src/game/controls';
import { eventCue } from '../../src/game/cue';
import { activeTurnSeat, describeHand, describeTrick, proposalNote, proposalStake, proposalVerb, teamLabel } from '../../src/game/describe';
import { hasOverlap, tableGeometry, type Rect } from '../../src/game/geometry';
import { resolveRole } from '../../src/game/role';
import { statusText } from '../../src/game/status';
import { insideSuperellipse, roundedRectPath, superellipseDepth, superellipsePath, surfaceMetrics } from '../../src/ui/shapes';

const base = (): PublicGameState => newMatch(seededRng(1)).public;
const names: Record<Seat, string> = { 1: 'Ana', 2: 'Bia', 3: 'Caio', 4: 'Duda' };
const nameOf = (seat: Seat) => names[seat];

describe('geometria da mesa', () => {
  const corners = (r: Rect) => [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x, y: r.y + r.h },
    { x: r.x + r.w, y: r.y + r.h },
  ];

  it.each([
    ['celular pequeno, metade de cima', 344, 250, 'compact'],
    ['celular comum, metade de cima', 395, 330, 'compact'],
    ['celular grande, metade de cima', 412, 420, 'compact'],
    ['celular largo e baixo, metade de cima', 480, 260, 'compact'],
    ['mesa dedicada', 395, 560, 'large'],
    ['mesa dedicada em celular pequeno', 344, 470, 'large'],
    ['mesa dedicada em celular bem pequeno (placar compacto)', 320, 380, 'large'],
    ['mesa dedicada em celular alto', 390, 700, 'large'],
    ['mesa dedicada em tablet', 760, 820, 'large'],
  ] as const)('%s: nada se sobrepõe e tudo fica inteiro dentro do feltro', (_, w, h, variant) => {
    // O conteúdo fica na área do feltro, dentro do aro de couro (como o TableBoard desenha).
    const m = surfaceMetrics(w, h, variant === 'large' ? 'table' : 'compact');
    const area = m.content;
    const g = tableGeometry(area.w, area.h, variant, m.n);
    expect(hasOverlap(g)).toBe(false);
    // Carta legível mesmo no celular pequeno, já descontado o aro.
    expect(g.card.w).toBeGreaterThanOrEqual(38);
    // Os quatro cantos de cada etiqueta e carta ficam dentro da curva do feltro, com folga:
    // antes as etiquetas passavam por cima do trilho e do couro perto dos cantos da mesa.
    const felt = { x: 0, y: 0, w: area.w, h: area.h };
    const visibleChips = (Object.keys(g.chips) as (keyof typeof g.chips)[])
      .filter((s) => s !== 'bottom' || g.bottomChipVisible)
      .map((s) => g.chips[s]);
    for (const r of [...visibleChips, ...Object.values(g.played), g.deck, g.vira, g.manilha, g.stage]) {
      for (const p of corners(r)) expect(insideSuperellipse(p, felt, m.n, 2)).toBe(true);
    }
  });

  it.each([
    [344, 250, 'compact'],
    [395, 330, 'compact'],
    [395, 560, 'large'],
    [760, 820, 'large'],
  ] as const)('palco do centro (%s x %s): cabe o aviso de truco sem tocar em carta jogada', (w, h, variant) => {
    const m = surfaceMetrics(w, h, variant === 'large' ? 'table' : 'compact');
    const g = tableGeometry(m.content.w, m.content.h, variant, m.n);
    // Altura mínima para o selo com o valor ficar legível; o palco cobre baralho e vira, não as cartas jogadas.
    expect(g.stage.h).toBeGreaterThanOrEqual(42);
    expect(g.stage.w).toBeGreaterThanOrEqual(100);
    expect(g.stage.y).toBeGreaterThanOrEqual(g.played.top.y + g.played.top.h);
    expect(g.stage.y + g.stage.h).toBeLessThanOrEqual(g.played.bottom.y);
  });

  it('etiquetas: largas em cima e embaixo, em coluna nas laterais', () => {
    const m = surfaceMetrics(395, 560, 'table');
    const g = tableGeometry(m.content.w, m.content.h, 'large', m.n);
    expect(g.chipLayout).toEqual({ top: 'row', bottom: 'row', left: 'column', right: 'column' });
    expect(g.chips.top.w).toBeGreaterThan(g.chips.left.w);
    expect(g.chips.left.h).toBeGreaterThan(g.chips.top.h);
  });

  it.each([
    [344, 250, 'compact'],
    [395, 330, 'compact'],
    [395, 560, 'large'],
    [760, 820, 'large'],
  ] as const)('cartas jogadas (%s x %s): um pouco menores que a carta-base, nunca abaixo de 38 pt', (w, h, variant) => {
    const m = surfaceMetrics(w, h, variant === 'large' ? 'table' : 'compact');
    const g = tableGeometry(m.content.w, m.content.h, variant, m.n);
    for (const r of Object.values(g.played)) {
      expect(r.w).toBeLessThanOrEqual(g.card.w);
      expect(r.w).toBeGreaterThanOrEqual(Math.min(38, g.card.w));
      expect(r.h / r.w).toBeCloseTo(726 / 500, 5);
    }
    // Onde há folga, a redução é a de PLAYED_SCALE (sem encolher baralho e vira).
    if (g.card.w * 0.88 >= 38) expect(g.played.top.w).toBeCloseTo(g.card.w * 0.88, 5);
    expect(g.vira.w).toBeCloseTo(g.card.w * (variant === 'large' ? 0.85 : 0.8), 5);
  });

  it('a mesa dedicada usa cartas maiores que a metade de cima do jogador', () => {
    const large = surfaceMetrics(395, 560, 'table');
    const compact = surfaceMetrics(395, 330, 'compact');
    expect(tableGeometry(large.content.w, large.content.h, 'large', large.n).card.w).toBeGreaterThan(
      tableGeometry(compact.content.w, compact.content.h, 'compact', compact.n).card.w,
    );
  });
});

describe('tampo da mesa', () => {
  it.each(['table', 'compact', 'panel'] as const)('%s: feltro dentro do tampo e conteúdo dentro da área', (variant) => {
    const m = surfaceMetrics(395, 560, variant);
    expect(m.felt.x).toBeGreaterThan(m.top.x);
    expect(m.felt.y).toBeGreaterThan(m.top.y);
    expect(m.felt.x + m.felt.w).toBeLessThan(m.top.x + m.top.w);
    expect(m.felt.y + m.felt.h).toBeLessThan(m.top.y + m.top.h);
    // A lateral do tampo (espessura) cabe embaixo, dentro da área medida.
    expect(m.top.y + m.top.h + m.apron).toBeLessThanOrEqual(560);
    expect(m.content.x).toBeGreaterThanOrEqual(0);
    expect(m.content.y).toBeGreaterThanOrEqual(0);
  });

  it('profundidade da curva: zero no meio do lado, cresce até o canto', () => {
    expect(superellipseDepth(0, 100, 3.4)).toBeCloseTo(0, 5);
    expect(superellipseDepth(1, 100, 3.4)).toBeCloseTo(100, 5);
    expect(superellipseDepth(0.6, 100, 3.4)).toBeGreaterThan(superellipseDepth(0.3, 100, 3.4));
    // Mesmo ponto: mais fundo numa mesa maior (por isso o recuo fixo não bastava).
    expect(superellipseDepth(0.6, 250, 3.4)).toBeGreaterThan(superellipseDepth(0.6, 100, 3.4));
  });

  it('bandeja (lobby, painel): cantos de raio fixo, iguais em qualquer tamanho', () => {
    expect(surfaceMetrics(320, 300, 'panel').corner).toBe(surfaceMetrics(760, 900, 'panel').corner);
    expect(surfaceMetrics(395, 560, 'table').corner).toBeNull();
    const d = roundedRectPath({ x: 0, y: 0, w: 200, h: 100 }, 12);
    expect(d.startsWith('M12 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
  });

  it('o aro da mesa dedicada é mais grosso que o da mesa compacta', () => {
    expect(surfaceMetrics(395, 560, 'table').rim).toBeGreaterThan(surfaceMetrics(395, 330, 'compact').rim);
  });

  it('superelipse: caminho fechado, inscrito na caixa e tocando os quatro lados', () => {
    const box = { x: 10, y: 20, w: 300, h: 400 };
    const d = superellipsePath(box, 3.4);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    const pts = [...d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    expect(Math.min(...xs)).toBeCloseTo(box.x, 0);
    expect(Math.max(...xs)).toBeCloseTo(box.x + box.w, 0);
    expect(Math.min(...ys)).toBeCloseTo(box.y, 0);
    expect(Math.max(...ys)).toBeCloseTo(box.y + box.h, 0);
  });
});

describe('controles de truco', () => {
  it('na própria vez, sem pedido: pedir truco (sozinho) e correr (com o parceiro)', () => {
    const state = base();
    const seat = state.currentTurnSeat;
    const { mode, controls } = trucoControls(state, getLegalActions(state, seat), seat);
    expect(mode).toBe('play');
    expect(controls.map((c) => [c.label, c.needsPartner])).toEqual([
      ['Pedir TRUCO', false],
      ['Correr', true],
    ]);
    expect(controls[1].hint).toContain('parceiro precisa confirmar');
  });

  it('fora da vez não pede truco, mas pode correr', () => {
    const state = base();
    const other = ((state.currentTurnSeat % 4) + 1) as Seat;
    expect(trucoControls(state, getLegalActions(state, other), other).controls.map((c) => c.id)).toEqual(['fold']);
  });

  it('com pedido pendente: a dupla adversária aceita, corre ou pede seis; a que pediu só aguarda', () => {
    const state: PublicGameState = { ...base(), truco: { value: 3, requestedBy: 'A', requestedBySeat: 1 } };
    const answer = trucoControls(state, getLegalActions(state, 2), 2);
    expect(answer.mode).toBe('respond');
    // Aceitar o 3 é individual; correr e pedir seis precisam do parceiro.
    expect(answer.controls.map((c) => [c.label, c.needsPartner])).toEqual([
      ['Aceitar', false],
      ['Correr', true],
      ['Pedir SEIS', true],
    ]);
    expect(trucoControls(state, getLegalActions(state, 3), 3)).toEqual({ mode: 'waiting_answer', controls: [] });
  });

  it('pedido de doze não pode ser aumentado', () => {
    const state: PublicGameState = { ...base(), handValue: 9, truco: { value: 12, requestedBy: 'B', requestedBySeat: 2 } };
    const { controls } = trucoControls(state, getLegalActions(state, 1), 1);
    expect(controls.map((c) => [c.id, c.needsPartner])).toEqual([
      ['accept', true],
      ['refuse', true],
    ]);
  });

  it('depois de aceitar seis, só quem aceitou pode pedir nove', () => {
    const state: PublicGameState = { ...base(), handValue: 6, raiseRight: 'B', currentTurnSeat: 2 };
    expect(trucoControls(state, getLegalActions(state, 2), 2).controls[0]).toMatchObject({ label: 'Pedir NOVE', needsPartner: true });
    const turnA: PublicGameState = { ...state, currentTurnSeat: 1 };
    expect(trucoControls(turnA, getLegalActions(turnA, 1), 1).controls.map((c) => c.id)).toEqual(['fold']);
  });

  it('mão de 11 não tem truco', () => {
    const state: PublicGameState = { ...base(), maoDeOnze: 'A', handValue: 3 };
    expect(trucoControls(state, getLegalActions(state, state.currentTurnSeat), state.currentTurnSeat).controls.map((c) => c.id)).toEqual([
      'fold',
    ]);
  });

  it('pedido da dupla: o parceiro confirma ou recusa, quem pediu só pode desistir, a outra dupla aguarda', () => {
    const proposal = { id: 4, team: 'A', decision: 'fold', proposedBy: 1, value: 1, handNumber: 1 } as const;
    const state: PublicGameState = { ...base(), proposal };
    const partner = trucoControls(state, getLegalActions(state, 3), 3);
    expect(partner.mode).toBe('proposal_confirm');
    expect(partner.controls.map((c) => [c.id, c.action])).toEqual([
      ['reject', { type: 'reject_proposal', proposalId: 4 }],
      ['confirm', { type: 'confirm_proposal', proposalId: 4 }],
    ]);
    expect(partner.controls[1].hint).toBe('Confirma correr: a outra dupla ganha 1 ponto');
    const mine = trucoControls(state, getLegalActions(state, 1), 1);
    expect(mine.mode).toBe('proposal_sent');
    expect(mine.controls.map((c) => [c.id, c.action])).toEqual([['cancel', { type: 'reject_proposal', proposalId: 4 }]]);
    expect(trucoControls(state, getLegalActions(state, 2), 2)).toEqual({ mode: 'proposal_other', controls: [] });
  });
});

describe('decisão em dupla na tela', () => {
  const players = (seat: Seat) => ['Ana Souza', 'Bia', 'Caio Lima', 'Duda'][seat - 1];
  const nameFor = (viewer: Seat) => (seat: Seat) => (seat === viewer ? 'Você' : players(seat));

  it('status: o parceiro vê o pedido e o que está em jogo; quem pediu, quem falta; os outros, só que há decisão', () => {
    const truco = { value: 6, requestedBy: 'B', requestedBySeat: 2 } as const;
    const proposal = { id: 2, team: 'A', decision: 'accept', proposedBy: 1, value: 6, handNumber: 1 } as const;
    const state: PublicGameState = { ...base(), handValue: 3, truco, proposal };
    const input = (viewer: Seat | null) => ({
      state,
      viewerSeat: viewer,
      nameOf: viewer ? nameFor(viewer) : players,
      canRespond: false,
      phase: 'done' as const,
    });
    expect(statusText(input(3))).toMatchObject({
      main: 'Ana quer aceitar o SEIS',
      tone: 'team',
      detail: 'Confirme ou recuse abaixo · a mão passa a valer 6',
    });
    expect(statusText(input(1))).toMatchObject({ main: 'Aguardando Caio confirmar', tone: 'team', detail: 'Você pediu para aceitar o SEIS · a mão passa a valer 6' });
    expect(statusText(input(2))).toMatchObject({ main: 'A outra dupla está decidindo…', tone: 'info' });
    expect(statusText(input(null))).toMatchObject({ main: 'Dupla A decidindo…' });
  });

  it('textos do pedido para cada decisão', () => {
    const p = (decision: 'fold' | 'refuse' | 'accept' | 'raise' | 'request_truco', value: number) =>
      ({ id: 1, team: 'A', decision, proposedBy: 1, value, handNumber: 1 }) as const;
    const truco = { value: 9, requestedBy: 'B', requestedBySeat: 2 } as const;
    expect(proposalVerb(p('fold', 3), null)).toBe('correr');
    expect(proposalVerb(p('refuse', 6), truco)).toBe('correr do NOVE');
    expect(proposalVerb(p('raise', 12), truco)).toBe('pedir DOZE');
    expect(proposalVerb(p('request_truco', 9), null)).toBe('pedir NOVE');
    expect(proposalStake(p('fold', 1))).toBe('a outra dupla ganha 1 ponto');
    expect(proposalStake(p('refuse', 6))).toBe('a outra dupla ganha 6 pontos');
    expect(proposalStake(p('request_truco', 9))).toBe('a mão pode passar a valer 9');
  });

  it('a vez não fica destacada enquanto a dupla decide', () => {
    const state: PublicGameState = { ...base(), proposal: { id: 1, team: 'B', decision: 'fold', proposedBy: 2, value: 1, handNumber: 1 } };
    expect(activeTurnSeat(state, false)).toBeNull();
    expect(activeTurnSeat({ ...state, proposal: null }, false)).toBe(state.currentTurnSeat);
  });

  it('avisos: pedido aberto não anuncia; recusa vira fala; confirmação anuncia a própria ação', () => {
    const state = base();
    const opened = { seat: 1, action: 'fold', proposal: { id: 1, status: 'opened', decision: 'fold', by: 1 } } as const;
    expect(eventCue(opened, state)).toBeNull();
    const rejected = { seat: 3, action: 'reject_proposal', proposal: { id: 1, status: 'rejected', decision: 'fold', by: 3 } } as const;
    expect(eventCue(rejected, state)).toEqual({ kind: 'speech', seat: 3, text: 'Não!' });
    const confirmed = { seat: 1, action: 'fold', proposal: { id: 1, status: 'confirmed', decision: 'fold', by: 3 } } as const;
    expect(eventCue(confirmed, state)).toEqual({ kind: 'speech', seat: 1, text: 'Corro!' });
    const accepted = { ...state, handValue: 6 as const, truco: null };
    const confirmedAccept = {
      seat: 2,
      action: 'respond_truco',
      response: 'accept',
      proposal: { id: 2, status: 'confirmed', decision: 'accept', by: 4 },
    } as const;
    expect(eventCue(confirmedAccept, accepted)).toEqual({ kind: 'accept', seat: 2, value: 6 });
  });

  it('aviso da dupla: só para a própria dupla e não para quem recusou', () => {
    const rejected = { seat: 3, action: 'reject_proposal', proposal: { id: 1, status: 'rejected', decision: 'fold', by: 3 } } as const;
    expect(proposalNote(rejected, 1, nameFor(1))).toBe('Caio não quis correr. A mão continua.');
    expect(proposalNote(rejected, 3, nameFor(3))).toBeNull();
    expect(proposalNote(rejected, 2, nameFor(2))).toBeNull();
    const cancelled = { seat: 1, action: 'reject_proposal', proposal: { id: 1, status: 'cancelled', decision: 'raise', by: 1 } } as const;
    expect(proposalNote(cancelled, 3, nameFor(3))).toBe('Ana desistiu de aumentar a aposta.');
    const invalid = { seat: 3, action: 'confirm_proposal', proposal: { id: 1, status: 'invalidated', decision: 'fold', by: 3 } } as const;
    expect(proposalNote(invalid, 3, nameFor(3))).toBe('O pedido da dupla não vale mais e foi cancelado.');
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
      main: 'Duda pediu SEIS!',
      detail: 'Dupla A responde',
      tone: 'truco',
    });
    expect(statusText({ state: truco, viewerSeat: 1, nameOf, canRespond: true, phase: 'done' })).toMatchObject({
      main: 'Duda pediu SEIS!',
      detail: 'Responda abaixo',
    });
    expect(statusText({ state: truco, viewerSeat: 2, nameOf, canRespond: false, phase: 'done' })?.detail).toBe(
      'Aguardando a resposta deles',
    );
    expect(statusText({ state: { ...state, status: 'finished' }, viewerSeat: 1, nameOf, canRespond: false, phase: 'done' })).toBeNull();
  });

  it('avisos: pedido, aumento, aceite e correr; carta jogada não tem aviso', () => {
    const state = base();
    const pending: PublicGameState = { ...state, truco: { value: 3, requestedBy: 'A', requestedBySeat: 1 } };
    expect(eventCue({ seat: 1, action: 'request_truco' }, pending)).toEqual({ kind: 'call', seat: 1, value: 3, raise: false });
    const raised: PublicGameState = { ...state, handValue: 3, truco: { value: 6, requestedBy: 'B', requestedBySeat: 2 } };
    expect(eventCue({ seat: 2, action: 'respond_truco', response: 'raise' }, raised)).toEqual({
      kind: 'call',
      seat: 2,
      value: 6,
      raise: true,
    });
    const accepted: PublicGameState = { ...state, handValue: 9, truco: null };
    expect(eventCue({ seat: 2, action: 'respond_truco', response: 'accept' }, accepted)).toEqual({ kind: 'accept', seat: 2, value: 9 });
    expect(eventCue({ seat: 2, action: 'respond_truco', response: 'refuse' }, state)).toEqual({ kind: 'speech', seat: 2, text: 'Corro!' });
    expect(eventCue({ seat: 4, action: 'fold' }, state)).toEqual({ kind: 'speech', seat: 4, text: 'Corro!' });
    expect(eventCue({ seat: 3, action: 'play_card', card: { rank: '4', suit: 'ouros' } }, state)).toBeNull();
    expect(eventCue(undefined, state)).toBeNull();
  });

  it('aviso só com o estado confirmado: pedido sem pedido pendente ou aceite com pedido pendente não aparecem', () => {
    const state = base();
    expect(eventCue({ seat: 1, action: 'request_truco' }, { ...state, truco: null })).toBeNull();
    const stillPending: PublicGameState = { ...state, truco: { value: 6, requestedBy: 'A', requestedBySeat: 1 } };
    expect(eventCue({ seat: 2, action: 'respond_truco', response: 'accept' }, stillPending)).toBeNull();
    expect(eventCue({ seat: 2, action: 'respond_truco', response: 'raise' }, { ...state, truco: null })).toBeNull();
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
  const players = [1, 2, 3, 4].map((seat) => ({
    seat: seat as Seat,
    team: seat % 2 ? 'A' : 'B',
    userId: `u${seat}`,
    displayName: `P${seat}`,
  })) as any;

  it('jogador da partida joga; a mesa registrada só assiste; o resto não vê', () => {
    expect(resolveRole('u2', match('mesa'), players)).toBe('player');
    expect(resolveRole('mesa', match('mesa'), players)).toBe('table');
    expect(resolveRole('mesa', match(null), players)).toBeNull();
    expect(resolveRole(null, match(null), players)).toBeNull();
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
    expect(parseAction({ type: 'confirm_proposal', proposalId: 3 })).toEqual({ type: 'confirm_proposal', proposalId: 3 });
    expect(parseAction({ type: 'reject_proposal', proposalId: 3, extra: 'x' })).toEqual({ type: 'reject_proposal', proposalId: 3 });
    expect(parseAction({ type: 'confirm_proposal' })).toBeNull();
    expect(parseAction({ type: 'confirm_proposal', proposalId: '3' })).toBeNull();
    expect(parseAction({ type: 'confirm_proposal', proposalId: 0 })).toBeNull();
    expect(parseAction({ type: 'confirm_proposal', proposalId: 1.5 })).toBeNull();
    expect(parseAction({ type: 'set_score', score: 12 })).toBeNull();
    expect(parseAction(null)).toBeNull();
  });
});
