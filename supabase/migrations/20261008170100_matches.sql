-- Decky: partidas, eventos públicos e mãos privadas.
-- As regras rodam na Edge Function (motor em TypeScript); estas funções só validam
-- posse, revisão e idempotência, e gravam tudo numa transação.

create schema if not exists private;
revoke all on schema private from public;

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  status text not null default 'playing' check (status in ('playing', 'finished')),
  -- Projeção pública do motor (PublicGameState). Nunca contém mãos.
  public_state jsonb not null,
  revision integer not null default 0,
  score_a smallint not null default 0 check (score_a between 0 and 12),
  score_b smallint not null default 0 check (score_b between 0 and 12),
  current_turn_seat smallint not null check (current_turn_seat between 1 and 4),
  winner_team text check (winner_team in ('A', 'B')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- No máximo uma partida em andamento por sala: é o que torna start_match idempotente.
create unique index matches_one_active_per_room on public.matches (room_id) where status = 'playing';

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  team text generated always as (case when seat % 2 = 1 then 'A' else 'B' end) stored,
  primary key (match_id, user_id),
  unique (match_id, seat)
);

create index match_players_user_id_idx on public.match_players (user_id);

create table public.match_events (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  -- Só fatos públicos: carta jogada, pedido e resposta de truco.
  payload_public jsonb not null default '{}'::jsonb,
  revision integer not null,
  client_action_id text,
  created_at timestamptz not null default now(),
  unique (match_id, client_action_id)
);

-- Schema não exposto pela API: sem GRANT para anon nem authenticated.
create table private.private_hands (
  match_id uuid not null references public.matches (id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cards jsonb not null default '[]'::jsonb,
  primary key (match_id, seat),
  unique (match_id, user_id)
);

alter table private.private_hands enable row level security;

create or replace function public.is_match_member(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_players
    where match_id = p_match_id and user_id = auth.uid()
  );
$$;

alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_events enable row level security;

create policy "partida visível para seus jogadores"
  on public.matches for select to authenticated using (public.is_match_member(id));

create policy "jogadores visíveis para membros da partida"
  on public.match_players for select to authenticated using (public.is_match_member(match_id));

create policy "eventos visíveis para membros da partida"
  on public.match_events for select to authenticated using (public.is_match_member(match_id));

revoke all on public.matches, public.match_players, public.match_events from anon, authenticated;
grant select on public.matches, public.match_players, public.match_events to authenticated;

-- ---------------------------------------------------------------------------
-- Porta única para a mão privada: devolve só a mão de quem chama.
-- ---------------------------------------------------------------------------
create or replace function public.get_my_hand(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('revision', m.revision, 'seat', h.seat, 'cards', h.cards)
  from private.private_hands h
  join public.matches m on m.id = h.match_id
  where h.match_id = p_match_id and h.user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Funções internas, chamadas só pela Edge Function com a chave de serviço.
-- ---------------------------------------------------------------------------

-- Cria a partida com o estado inicial sorteado pelo motor. Idempotente por sala.
create or replace function public.internal_start_match(
  p_room_id uuid,
  p_user_id uuid,
  p_state jsonb,
  p_hands jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
  v_match_id uuid;
  v_players integer;
  v_ready integer;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or not exists (
    select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id
  ) then
    return jsonb_build_object('ok', false, 'error', 'room_not_found');
  end if;

  select id into v_match_id from public.matches where room_id = p_room_id and status = 'playing';
  if found then
    return jsonb_build_object('ok', true, 'matchId', v_match_id, 'existing', true);
  end if;

  if v_room.host_user_id <> p_user_id then
    return jsonb_build_object('ok', false, 'error', 'not_host');
  end if;

  select count(*), count(*) filter (where ready) into v_players, v_ready
  from public.room_players where room_id = p_room_id;
  if v_players < 4 then
    return jsonb_build_object('ok', false, 'error', 'not_enough_players');
  end if;
  if v_ready < 4 then
    return jsonb_build_object('ok', false, 'error', 'players_not_ready');
  end if;

  insert into public.matches (room_id, public_state, current_turn_seat)
  values (p_room_id, p_state, (p_state ->> 'currentTurnSeat')::smallint)
  returning id into v_match_id;

  insert into public.match_players (match_id, user_id, seat)
  select v_match_id, user_id, seat from public.room_players where room_id = p_room_id;

  insert into private.private_hands (match_id, seat, user_id, cards)
  select v_match_id, seat, user_id, p_hands -> (seat - 1)
  from public.room_players where room_id = p_room_id;

  insert into public.match_events (match_id, actor_user_id, action, revision)
  values (v_match_id, p_user_id, 'start_match', 0);

  update public.rooms set status = 'playing' where id = p_room_id;

  return jsonb_build_object('ok', true, 'matchId', v_match_id, 'existing', false);
end;
$$;

-- Lê o estado completo para o motor. Se a ação já foi processada, avisa (idempotência).
create or replace function public.internal_get_match(
  p_match_id uuid,
  p_user_id uuid,
  p_client_action_id text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_seat smallint;
  v_done_revision integer;
begin
  select * into v_match from public.matches where id = p_match_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found');
  end if;

  select seat into v_seat from public.match_players where match_id = p_match_id and user_id = p_user_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  select revision into v_done_revision
  from public.match_events
  where match_id = p_match_id and client_action_id = p_client_action_id;
  if found then
    return jsonb_build_object('ok', true, 'duplicate', true, 'revision', v_done_revision);
  end if;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'seat', v_seat,
    'revision', v_match.revision,
    'state', v_match.public_state,
    'hands', (select jsonb_agg(cards order by seat) from private.private_hands where match_id = p_match_id)
  );
end;
$$;

-- Grava o resultado de uma ação. Trava a partida e só aceita se a revisão não mudou.
create or replace function public.internal_commit_action(
  p_match_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_state jsonb,
  p_hands jsonb,
  p_event jsonb,
  p_client_action_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_done_revision integer;
  v_new_revision integer;
  v_finished boolean := p_state ->> 'status' = 'finished';
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found');
  end if;

  select revision into v_done_revision
  from public.match_events
  where match_id = p_match_id and client_action_id = p_client_action_id;
  if found then
    return jsonb_build_object('ok', true, 'newRevision', v_done_revision, 'duplicate', true);
  end if;

  if v_match.status <> 'playing' then
    return jsonb_build_object('ok', false, 'error', 'match_over');
  end if;
  if v_match.revision <> p_expected_revision then
    return jsonb_build_object('ok', false, 'error', 'conflict');
  end if;

  v_new_revision := v_match.revision + 1;

  update public.matches set
    public_state = p_state,
    revision = v_new_revision,
    score_a = (p_state -> 'score' ->> 'A')::smallint,
    score_b = (p_state -> 'score' ->> 'B')::smallint,
    current_turn_seat = (p_state ->> 'currentTurnSeat')::smallint,
    status = case when v_finished then 'finished' else 'playing' end,
    winner_team = p_state ->> 'winnerTeam',
    ended_at = case when v_finished then now() end
  where id = p_match_id;

  update private.private_hands h
  set cards = p_hands -> (h.seat - 1)
  where h.match_id = p_match_id;

  insert into public.match_events (match_id, actor_user_id, action, payload_public, revision, client_action_id)
  values (p_match_id, p_user_id, p_event ->> 'action', p_event, v_new_revision, p_client_action_id);

  -- Fim de partida: a sala volta ao lobby para uma nova partida.
  if v_finished then
    update public.rooms set status = 'lobby' where id = v_match.room_id;
    update public.room_players set ready = false where room_id = v_match.room_id;
  end if;

  return jsonb_build_object('ok', true, 'newRevision', v_new_revision, 'duplicate', false);
end;
$$;

revoke execute on function
  public.is_match_member(uuid),
  public.get_my_hand(uuid),
  public.internal_start_match(uuid, uuid, jsonb, jsonb),
  public.internal_get_match(uuid, uuid, text),
  public.internal_commit_action(uuid, uuid, integer, jsonb, jsonb, jsonb, text)
from public, anon, authenticated;

grant execute on function public.is_match_member(uuid), public.get_my_hand(uuid) to authenticated;

grant execute on function
  public.internal_start_match(uuid, uuid, jsonb, jsonb),
  public.internal_get_match(uuid, uuid, text),
  public.internal_commit_action(uuid, uuid, integer, jsonb, jsonb, jsonb, text)
to service_role;

-- Realtime só para tabelas públicas; a mão privada nunca é publicada.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rooms, public.room_players, public.matches;
  end if;
end;
$$;
