// Utilitários das Edge Functions (Deno). Não importar no app.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Cliente com a chave de serviço: só existe no servidor e só chama as funções internas. */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente no ambiente da função');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** Adapta o cliente de serviço ao formato `Rpc` do match-service: devolve o jsonb ou lança. */
export function rpcFor(admin: SupabaseClient) {
  return async (fn: string, params: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(fn, params);
    if (error) throw error;
    return data;
  };
}

/** Valida o token do usuário que chamou a função e devolve o id dele. */
export async function authenticatedUserId(req: Request, admin: SupabaseClient): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

/** Envolve o handler: CORS, só POST, autenticação e erro inesperado como 500. */
export function serve(handler: (body: any, userId: string, admin: SupabaseClient) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    try {
      const admin = adminClient();
      const userId = await authenticatedUserId(req, admin);
      if (!userId) return json({ ok: false, error: 'not_authenticated' }, 401);
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object') return json({ ok: false, error: 'bad_request' }, 400);
      return await handler(body, userId, admin);
    } catch (error) {
      console.error(error);
      return json({ ok: false, error: 'server_error' }, 500);
    }
  });
}
