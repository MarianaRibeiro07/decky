// POST { roomId } -> { ok: true, matchId } | { ok: false, error }
// Sorteia as cartas no servidor e grava a partida. Idempotente: se já houver partida
// em andamento na sala, devolve a mesma.
import { cryptoRng, newMatch } from '../_shared/engine/index.ts';
import { json, serve } from '../_shared/http.ts';

serve(async (body, userId, admin) => {
  const roomId = body.roomId;
  if (typeof roomId !== 'string') return json({ ok: false, error: 'bad_request' }, 400);

  const state = newMatch(cryptoRng());
  const { data, error } = await admin.rpc('internal_start_match', {
    p_room_id: roomId,
    p_user_id: userId,
    p_state: state.public,
    p_hands: state.hands,
  });
  if (error) throw error;

  // Resultado sem cartas: a mão de cada um é buscada por get_my_hand.
  return json(data.ok ? { ok: true, matchId: data.matchId } : { ok: false, error: data.error });
});
