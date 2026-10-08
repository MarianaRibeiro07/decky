// POST { matchId, action, expectedRevision, clientActionId } -> GameResult
// 1. Lê o estado completo (já respondendo se a ação é repetida).
// 2. Confere a revisão que o cliente viu.
// 3. Aplica a regra no motor.
// 4. Grava estado, mãos e evento numa transação que só passa se a revisão não mudou.
import { applyAction, cryptoRng } from '../_shared/engine/index.ts';
import type { GameAction, MatchState } from '../_shared/engine/index.ts';
import { json, serve } from '../_shared/http.ts';

const ACTION_TYPES = ['play_card', 'request_truco', 'respond_truco', 'fold'];

function isAction(value: any): value is GameAction {
  return value && typeof value === 'object' && ACTION_TYPES.includes(value.type);
}

serve(async (body, userId, admin) => {
  const { matchId, action, expectedRevision, clientActionId } = body;
  if (
    typeof matchId !== 'string' ||
    !isAction(action) ||
    !Number.isInteger(expectedRevision) ||
    typeof clientActionId !== 'string' ||
    clientActionId.length === 0 ||
    clientActionId.length > 100
  ) {
    return json({ ok: false, error: 'bad_request' }, 400);
  }

  const { data: loaded, error: loadError } = await admin.rpc('internal_get_match', {
    p_match_id: matchId,
    p_user_id: userId,
    p_client_action_id: clientActionId,
  });
  if (loadError) throw loadError;
  if (!loaded.ok) return json({ ok: false, error: loaded.error });
  if (loaded.duplicate) return json({ ok: true, newRevision: loaded.revision });
  if (loaded.revision !== expectedRevision) return json({ ok: false, error: 'conflict' });

  const current: MatchState = { public: loaded.state, hands: loaded.hands };
  const result = applyAction(current, loaded.seat, action, cryptoRng());
  if (!result.ok) return json({ ok: false, error: result.error });

  const { data: saved, error: saveError } = await admin.rpc('internal_commit_action', {
    p_match_id: matchId,
    p_user_id: userId,
    p_expected_revision: loaded.revision,
    p_state: result.state.public,
    p_hands: result.state.hands,
    p_event: result.event,
    p_client_action_id: clientActionId,
  });
  if (saveError) throw saveError;

  return json(saved.ok ? { ok: true, newRevision: saved.newRevision } : { ok: false, error: saved.error });
});
