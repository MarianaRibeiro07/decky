// Junção de uma leitura nova com o estado que a tela já tem. Puro, para ser testado sem React Native.
import type { Card, GameResult, MatchPlayer, MatchRole, MatchView, PrivateHand } from '../contracts/types';
import { resolveRole } from './role';

export interface MatchData {
  match: MatchView | null;
  hand: PrivateHand | null;
  players: MatchPlayer[];
  /** Jogador (tem mão) ou mesa central (só estado público). null antes de carregar. */
  role: MatchRole | null;
  loaded: boolean;
  /** true quando a partida não existe ou o usuário não pode vê-la. */
  notFound: boolean;
}

export const EMPTY_MATCH_DATA: MatchData = { match: null, hand: null, players: [], role: null, loaded: false, notFound: false };

export interface MatchRead {
  match: MatchView;
  players: MatchPlayer[];
  /** undefined = a mão não foi buscada nesta leitura (a revisão não mudou). */
  hand: PrivateHand | null | undefined;
}

const sameCards = (a: Card[], b: Card[]) =>
  a.length === b.length && a.every((card, i) => card.rank === b[i].rank && card.suit === b[i].suit);

const samePlayers = (a: MatchPlayer[], b: MatchPlayer[]) =>
  a.length === b.length &&
  a.every((p, i) => p.seat === b[i].seat && p.userId === b[i].userId && p.displayName === b[i].displayName);

/**
 * Junta a leitura ao estado atual reaproveitando os objetos que não mudaram.
 * - Polling e avisos repetidos do Realtime trazem a mesma revisão: devolve `prev` intacto,
 *   e o React não redesenha a partida (antes, cada leitura recriava tudo a cada 4 s).
 * - Leituras fora de ordem nunca voltam para uma revisão mais antiga.
 * - Quem não é jogador nunca guarda mão, nem por engano (a mesa central não tem mão).
 */
export function mergeMatchData(prev: MatchData, read: MatchRead, userId: string | null): MatchData {
  const old = prev.match;
  const match = old && old.matchId === read.match.matchId && old.revision >= read.match.revision ? old : read.match;
  const players = samePlayers(prev.players, read.players) ? prev.players : read.players;

  let hand: PrivateHand | null;
  if (read.hand === undefined) hand = prev.hand;
  else if (prev.hand && read.hand && read.hand.revision < prev.hand.revision) hand = prev.hand;
  else if (
    prev.hand &&
    read.hand &&
    prev.hand.revision === read.hand.revision &&
    prev.hand.seat === read.hand.seat &&
    sameCards(prev.hand.cards, read.hand.cards)
  )
    hand = prev.hand;
  else hand = read.hand;

  const role = resolveRole(userId, match, players);
  if (role !== 'player') hand = null;

  if (
    prev.loaded &&
    !prev.notFound &&
    match === prev.match &&
    players === prev.players &&
    hand === prev.hand &&
    role === prev.role &&
    role !== null
  ) {
    return prev;
  }
  return { match, hand, players, role, loaded: true, notFound: role === null };
}

/**
 * Leitura montada com o que o submit-action devolveu (estado gravado e a mão de quem agiu), para a tela
 * de quem agiu atualizar sem esperar as leituras de `matches` e `get_my_hand`. null quando a resposta não
 * traz o estado (ação repetida, servidor antigo, erro): aí a tela relê como antes.
 * Passa por `mergeMatchData`, então nunca volta para uma revisão mais antiga do que a que a tela já tem.
 */
export function readFromResult(current: MatchData, result: GameResult): MatchRead | null {
  if (!result.ok || !result.state || !current.match) return null;
  return {
    match: { ...current.match, revision: result.newRevision, state: result.state },
    players: current.players,
    hand: result.hand ?? undefined,
  };
}

/**
 * A mão precisa ser (re)lida depois de ler o estado? Só para jogador, só se a revisão mudou desde a
 * última mão conhecida, e não quando a mão lida em paralelo (`early`) já é da revisão do estado ou mais
 * nova. Uma mão paralela mais velha que o estado (corrida com outra jogada) é relida: a tela nunca
 * mostra uma mão mais antiga que a mesa.
 */
export function needsHandRead(
  isPlayer: boolean,
  knownHandRevision: number | null,
  matchRevision: number,
  early: PrivateHand | null | undefined,
): boolean {
  if (!isPlayer || knownHandRevision === matchRevision) return false;
  return !early || early.revision < matchRevision;
}
