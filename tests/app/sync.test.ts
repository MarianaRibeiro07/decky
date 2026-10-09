// Sincronização no app: leituras repetidas, fora de ordem e assinaturas Realtime.
import { describe, expect, it } from 'vitest';
import { newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { MatchPlayer, MatchView, PrivateHand } from '../../src/contracts/types';
import { channelTopic } from '../../src/lib/channelTopic';
import { EMPTY_MATCH_DATA, mergeMatchData, type MatchData } from '../../src/game/matchData';

const PLAYERS: MatchPlayer[] = [
  { seat: 1, team: 'A', userId: 'u1', displayName: 'Ana' },
  { seat: 2, team: 'B', userId: 'u2', displayName: 'Bia' },
  { seat: 3, team: 'A', userId: 'u3', displayName: 'Caio' },
  { seat: 4, team: 'B', userId: 'u4', displayName: 'Duda' },
];

const game = newMatch(seededRng(7));

/** Simula o que o Supabase devolve: objetos novos a cada leitura, mesmo sem mudança (JSON novo). */
function read(revision: number, tableUserId: string | null = null): MatchView {
  return JSON.parse(
    JSON.stringify({ matchId: 'm1', roomId: 'r1', roomCode: 'ABC123', revision, state: game.public, tableUserId }),
  );
}
const handOf = (seat: 1 | 2 | 3 | 4, revision: number): PrivateHand =>
  JSON.parse(JSON.stringify({ seat, revision, cards: game.hands[seat - 1] }));
const playersRead = () => JSON.parse(JSON.stringify(PLAYERS)) as MatchPlayer[];

describe('leituras repetidas não redesenham a partida', () => {
  it('polling com a mesma revisão devolve exatamente o mesmo estado (o React não re-renderiza)', () => {
    const first = mergeMatchData(EMPTY_MATCH_DATA, { match: read(3), players: playersRead(), hand: handOf(1, 3) }, 'u1');
    expect(first).toMatchObject({ role: 'player', loaded: true, notFound: false });

    // Poll seguinte: mesma revisão, mão não buscada.
    expect(mergeMatchData(first, { match: read(3), players: playersRead(), hand: undefined }, 'u1')).toBe(first);
    // Realtime duplicado trazendo a mão de novo, igual.
    expect(mergeMatchData(first, { match: read(3), players: playersRead(), hand: handOf(1, 3) }, 'u1')).toBe(first);
  });

  it('revisão nova troca só o que mudou e mantém a lista de jogadores', () => {
    const first = mergeMatchData(EMPTY_MATCH_DATA, { match: read(3), players: playersRead(), hand: handOf(1, 3) }, 'u1');
    const next = mergeMatchData(first, { match: read(4), players: playersRead(), hand: handOf(1, 4) }, 'u1');
    expect(next).not.toBe(first);
    expect(next.match!.revision).toBe(4);
    expect(next.players).toBe(first.players);
  });

  it('leitura atrasada (fora de ordem) não volta para uma revisão antiga', () => {
    const now = mergeMatchData(EMPTY_MATCH_DATA, { match: read(5), players: playersRead(), hand: handOf(1, 5) }, 'u1');
    const late = mergeMatchData(now, { match: read(4), players: playersRead(), hand: handOf(1, 4) }, 'u1');
    expect(late).toBe(now);
  });
});

describe('a mesa central nunca guarda mão', () => {
  it('o aparelho da mesa fica com hand = null, mesmo que algo chegue por engano', () => {
    const table = mergeMatchData(EMPTY_MATCH_DATA, { match: read(1, 'mesa'), players: playersRead(), hand: null }, 'mesa');
    expect(table).toMatchObject({ role: 'table', hand: null });

    // Defesa em profundidade: o servidor devolve null para a mesa, mas se uma mão chegasse ela seria descartada.
    const wrong = mergeMatchData(table, { match: read(2, 'mesa'), players: playersRead(), hand: handOf(1, 2) }, 'mesa');
    expect(wrong).toMatchObject({ role: 'table', hand: null });
  });

  it('quem não joga nem é a mesa não vê a partida', () => {
    const outsider = mergeMatchData(EMPTY_MATCH_DATA, { match: read(1, 'mesa'), players: playersRead(), hand: null }, 'intruso');
    expect(outsider).toMatchObject({ role: null, notFound: true, hand: null });
  });
});

describe('assinaturas Realtime', () => {
  it('cada montagem da tela recebe um canal novo, mesmo com a mesma chave', () => {
    // Antes: o mesmo nome devolvia o canal antigo já inscrito e .on() lançava erro ao remontar.
    const a = channelTopic('match:m1');
    const b = channelTopic('match:m1');
    expect(a).not.toBe(b);
    expect(a.startsWith('live:match:m1:')).toBe(true);
  });
});

// Garante que o tipo exportado continua compatível com o hook.
const _typecheck: MatchData = EMPTY_MATCH_DATA;
void _typecheck;
