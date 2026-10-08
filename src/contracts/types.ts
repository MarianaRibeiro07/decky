// RASCUNHO de T-00. Vira definitivo quando Caio, Eduardo e Rafael aprovarem (docs/ARCHITECTURE.md).

export type Suit = 'ouros' | 'espadas' | 'copas' | 'paus';
export type Rank = '4' | '5' | '6' | '7' | 'Q' | 'J' | 'K' | 'A' | '2' | '3';
export interface Card {
  rank: Rank;
  suit: Suit;
}

export type Team = 'A' | 'B';
export type SeatNumber = 1 | 2 | 3 | 4;

export interface UserProfile {
  id: string;
  displayName: string;
}

export type RoomStatus = 'lobby' | 'playing' | 'finished';
export interface Room {
  id: string;
  code: string;
  hostUserId: string;
  status: RoomStatus;
}

export interface RoomSeat {
  seat: SeatNumber;
  team: Team;
  userId: string | null;
  ready: boolean;
}

export interface TableCard {
  seat: SeatNumber;
  card: Card;
}

export type TrucoStatus =
  | { phase: 'none'; value: 1 }
  | { phase: 'pending'; value: 3 | 6 | 9 | 12; requestedBy: Team };

export interface PublicGameState {
  matchId: string;
  revision: number;
  score: Record<Team, number>;
  vira: Card;
  manilhaRank: Rank;
  currentTurnSeat: SeatNumber;
  handValue: 1 | 3 | 6 | 9 | 12;
  trucoStatus: TrucoStatus;
  tableCards: TableCard[];
  trickWins: Team[];
  winnerTeam: Team | null;
}

export interface PrivateHand {
  matchId: string;
  revision: number;
  cards: Card[];
}

export type GameActionType = 'play_card' | 'request_truco' | 'respond_truco' | 'fold';

export interface GameAction {
  matchId: string;
  type: GameActionType;
  payload: { card?: Card; accept?: boolean; raise?: boolean };
  expectedRevision: number;
  clientActionId: string;
}

export type GameResult =
  | { ok: true; newRevision: number }
  | { ok: false; error: 'conflict' | 'not_your_turn' | 'invalid_card' | 'illegal_action' | 'duplicate' };
