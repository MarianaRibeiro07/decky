// Tipos do motor de regras. Fonte única: o app reexporta daqui (src/contracts/types.ts).
// TypeScript puro, sem Node nem Deno, para rodar nos testes (Vitest) e na Edge Function.

export type Suit = 'ouros' | 'espadas' | 'copas' | 'paus';
export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';

export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Team = 'A' | 'B';
export type Seat = 1 | 2 | 3 | 4;
export type HandValue = 1 | 3 | 6 | 9 | 12;
export type TrickResult = Team | 'tie';

export interface TableCard {
  seat: Seat;
  card: Card;
}

/** Pedido de truco aguardando resposta da dupla adversária. */
export interface TrucoRequest {
  value: 3 | 6 | 9 | 12;
  requestedBy: Team;
  requestedBySeat: Seat;
}

export type HandEndReason = 'tricks' | 'refused' | 'fold' | 'all_tied';

export interface HandSummary {
  /** null quando ninguém pontua (três vazas empatadas). */
  winner: Team | null;
  points: number;
  reason: HandEndReason;
}

/** Estado que qualquer membro da partida pode ver. Nunca contém mãos. */
export interface PublicGameState {
  status: 'playing' | 'finished';
  handNumber: number;
  dealerSeat: Seat;
  score: Record<Team, number>;
  vira: Card;
  manilhaRank: Rank;
  currentTurnSeat: Seat;
  /** Valor já aceito da mão em jogo. */
  handValue: HandValue;
  truco: TrucoRequest | null;
  /** Dupla que pode pedir o próximo aumento; null = qualquer uma. */
  raiseRight: Team | null;
  /** Dupla(s) na mão de 11; nessa mão não há truco. */
  maoDeOnze: Team | 'both' | null;
  tableCards: TableCard[];
  trickResults: TrickResult[];
  lastTrick: { cards: TableCard[]; result: TrickResult } | null;
  lastHand: HandSummary | null;
  /** Última ação aceita pelo servidor. Opcional: partidas gravadas antes desta versão não têm. */
  lastEvent?: PublicEvent | null;
  winnerTeam: Team | null;
}

/** Estado completo, só existe no servidor. hands[0] é a mão do assento 1. */
export interface MatchState {
  public: PublicGameState;
  hands: Card[][];
}

export type TrucoResponse = 'accept' | 'refuse' | 'raise';

export type GameAction =
  | { type: 'play_card'; card: Card }
  | { type: 'request_truco' }
  | { type: 'respond_truco'; response: TrucoResponse }
  | { type: 'fold' };

export type GameActionType = GameAction['type'];

export type RuleError = 'not_your_turn' | 'invalid_card' | 'illegal_action' | 'match_over';

/** Evento público gravado em match_events. Nada sensível aqui. */
export interface PublicEvent {
  seat: Seat;
  action: GameActionType;
  card?: Card;
  response?: TrucoResponse;
}

export type ApplyResult =
  | { ok: true; state: MatchState; event: PublicEvent }
  | { ok: false; error: RuleError };

/** Gera um número em [0, 1). Injetável para testes determinísticos. */
export type Rng = () => number;
