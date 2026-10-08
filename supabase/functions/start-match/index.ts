// POST { roomId } -> { ok: true, matchId } | { ok: false, error }
// A regra fica em _shared/match-service.ts (testada em tests/sql/flow.test.ts).
import { cryptoRng } from '../_shared/engine/index.ts';
import { json, rpcFor, serve } from '../_shared/http.ts';
import { startMatchService } from '../_shared/match-service.ts';

serve(async (body, userId, admin) => {
  const { status, body: result } = await startMatchService(rpcFor(admin), userId, body, cryptoRng());
  return json(result, status);
});
