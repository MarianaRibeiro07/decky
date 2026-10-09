import type { MatchPlayer, MatchRole, MatchView, PrivateHand } from '../contracts/types';

/**
 * Papel deste aparelho a partir do que o servidor entregou: jogador (está em match_players
 * e tem mão) ou mesa (é o table_user_id da partida). null = não pode ver a partida.
 */
export function resolveRole(
  userId: string | null,
  match: MatchView,
  players: MatchPlayer[],
  hand: PrivateHand | null,
): MatchRole | null {
  if (hand || players.some((p) => p.userId === userId)) return 'player';
  if (userId && match.tableUserId === userId) return 'table';
  return null;
}
