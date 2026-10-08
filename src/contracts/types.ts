// Contratos entre app e servidor (T-00).
// Os tipos do jogo vêm do motor, para existir uma única definição.
// `export type` é apagado na compilação: o app não carrega código do motor por aqui.
export type {
  Card,
  GameAction,
  GameActionType,
  HandSummary,
  HandValue,
  PublicGameState,
  Rank,
  Seat,
  Suit,
  TableCard,
  Team,
  TrickResult,
  TrucoRequest,
  TrucoResponse,
} from '../../supabase/functions/_shared/engine/types.ts';

import type { Card, GameAction, PublicGameState, Seat, Team } from '../../supabase/functions/_shared/engine/types.ts';

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
  seat: Seat;
  team: Team;
  userId: string;
  displayName: string;
  ready: boolean;
}

export interface MatchPlayer {
  seat: Seat;
  team: Team;
  userId: string;
  displayName: string;
}

/** Estado público como o app recebe: projeção do motor mais a revisão do banco. */
export interface MatchView {
  matchId: string;
  roomId: string;
  /** Código da sala, para voltar ao lobby no fim. */
  roomCode: string | null;
  revision: number;
  state: PublicGameState;
}

/** Mão privada: só a do próprio usuário, via get_my_hand. */
export interface PrivateHand {
  revision: number;
  seat: Seat;
  cards: Card[];
}

/** Corpo enviado para a Edge Function submit-action. */
export interface ActionRequest {
  matchId: string;
  action: GameAction;
  expectedRevision: number;
  clientActionId: string;
}

export type GameError =
  | 'not_your_turn'
  | 'invalid_card'
  | 'illegal_action'
  | 'match_over'
  | 'conflict'
  | 'not_member'
  | 'match_not_found'
  | 'not_authenticated'
  | 'bad_request'
  | 'server_error'
  | 'network_error';

export type GameResult = { ok: true; newRevision: number } | { ok: false; error: GameError };

export type StartMatchResult = { ok: true; matchId: string } | { ok: false; error: string };

export interface MatchNote {
  id: string;
  matchId: string;
  title: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchSummary {
  id: string;
  status: 'playing' | 'finished';
  scoreA: number;
  scoreB: number;
  winnerTeam: Team | null;
  myTeam: Team;
  startedAt: string;
  endedAt: string | null;
}
