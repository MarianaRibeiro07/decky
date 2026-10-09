-- Decky: modo de host.
-- 'player': o dono da sala ocupa um lugar e joga (4 aparelhos).
-- 'table' : o dono não joga; o aparelho dele vira a mesa central (5 aparelhos).
-- A mesa só lê o estado público: não tem mão, não aparece em match_players e
-- internal_get_match a recusa, então ela não consegue agir como jogador.

alter table public.rooms
  add column host_mode text not null default 'player' check (host_mode in ('player', 'table'));

-- Aparelho que atuou como mesa na partida (null quando o dono jogou).
alter table public.matches
  add column table_user_id uuid references public.profiles (id) on delete set null;

create or replace function public.is_room_host(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rooms
    where id = p_room_id and host_user_id = auth.uid()
  );
$$;

-- Quem pode ver o estado público da partida: os 4 jogadores e a mesa.
create or replace function public.is_match_viewer(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_match_member(p_match_id)
    or exists (
      select 1 from public.matches
      where id = p_match_id and table_user_id = auth.uid()
    );
$$;

-- ---------------------------------------------------------------------------
-- RLS: o dono vê a própria sala mesmo sem ocupar lugar; a mesa vê a partida.
-- ---------------------------------------------------------------------------
drop policy "sala visível para seus membros" on public.rooms;
create policy "sala visível para membros e para o dono"
  on public.rooms for select to authenticated
  using (host_user_id = auth.uid() or public.is_room_member(id));

drop policy "posições visíveis para membros da sala" on public.room_players;
create policy "posições visíveis para membros e para o dono"
  on public.room_players for select to authenticated
  using (public.is_room_member(room_id) or public.is_room_host(room_id));

drop policy "partida visível para seus jogadores" on public.matches;
create policy "partida visível para jogadores e mesa"
  on public.matches for select to authenticated using (public.is_match_viewer(id));

drop policy "jogadores visíveis para membros da partida" on public.match_players;
create policy "jogadores visíveis para jogadores e mesa"
  on public.match_players for select to authenticated using (public.is_match_viewer(match_id));

drop policy "eventos visíveis para membros da partida" on public.match_events;
create policy "eventos visíveis para jogadores e mesa"
  on public.match_events for select to authenticated using (public.is_match_viewer(match_id));

-- ---------------------------------------------------------------------------
-- Salas
-- ---------------------------------------------------------------------------
drop function public.create_room();

create or replace function public.create_room(p_host_mode text default 'player')
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
  v_room public.rooms;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  if p_host_mode is null or p_host_mode not in ('player', 'table') then
    raise exception 'invalid_mode';
  end if;
  perform public.ensure_profile(v_user);

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, host_user_id, host_mode) values (v_code, v_user, p_host_mode) returning * into v_room;
  -- No modo mesa o dono não ocupa lugar: os 4 lugares ficam para os jogadores.
  if p_host_mode = 'player' then
    insert into public.room_players (room_id, user_id, seat) values (v_room.id, v_user, 1);
  end if;
  return v_room;
end;
$$;

create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_seat smallint;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;
  perform public.ensure_profile(v_user);

  -- Trava a sala: duas entradas simultâneas não disputam a mesma posição.
  select * into v_room from public.rooms where code = upper(trim(p_code)) for update;
  if not found then
    raise exception 'room_not_found';
  end if;
  -- O dono já pertence à sala, sentado (modo jogador) ou como mesa.
  if v_room.host_user_id = v_user
     or exists (select 1 from public.room_players where room_id = v_room.id and user_id = v_user) then
    raise exception 'already_in_room';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started';
  end if;

  select s into v_seat
  from generate_series(1, 4) as s
  where not exists (select 1 from public.room_players where room_id = v_room.id and seat = s)
  order by s
  limit 1;
  if v_seat is null then
    raise exception 'room_full';
  end if;

  insert into public.room_players (room_id, user_id, seat) values (v_room.id, v_user, v_seat);
  return v_room;
end;
$$;

-- O dono troca o próprio papel no lobby: sentar para jogar ou liberar o lugar e virar a mesa.
create or replace function public.set_host_mode(p_room_id uuid, p_host_mode text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_seat smallint;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or v_room.host_user_id <> v_user then
    raise exception 'not_host';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started';
  end if;
  if p_host_mode is null or p_host_mode not in ('player', 'table') then
    raise exception 'invalid_mode';
  end if;
  if p_host_mode = v_room.host_mode then
    return;
  end if;

  if p_host_mode = 'table' then
    delete from public.room_players where room_id = p_room_id and user_id = v_user;
  else
    select s into v_seat
    from generate_series(1, 4) as s
    where not exists (select 1 from public.room_players where room_id = p_room_id and seat = s)
    order by s
    limit 1;
    if v_seat is null then
      raise exception 'room_full';
    end if;
    insert into public.room_players (room_id, user_id, seat) values (p_room_id, v_user, v_seat);
  end if;

  update public.rooms set host_mode = p_host_mode where id = p_room_id;
end;
$$;

-- Sai da sala no lobby. Se o dono sair, a sala passa para quem entrou primeiro
-- (que já está sentado, então a sala volta ao modo jogador); sem ninguém, é apagada.
create or replace function public.leave_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_room public.rooms;
  v_next_host uuid;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or not (v_room.host_user_id = v_user or public.is_room_member(p_room_id)) then
    raise exception 'room_not_found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started';
  end if;

  delete from public.room_players where room_id = p_room_id and user_id = v_user;

  if v_room.host_user_id = v_user then
    select user_id into v_next_host
    from public.room_players
    where room_id = p_room_id
    order by joined_at
    limit 1;

    if v_next_host is null then
      delete from public.rooms where id = p_room_id;
    else
      update public.rooms set host_user_id = v_next_host, host_mode = 'player' where id = p_room_id;
    end if;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Início da partida: aceita o dono mesmo sem lugar e registra a mesa.
-- ---------------------------------------------------------------------------
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
  if not found or not (
    v_room.host_user_id = p_user_id
    or exists (select 1 from public.room_players where room_id = p_room_id and user_id = p_user_id)
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

  insert into public.matches (room_id, public_state, current_turn_seat, table_user_id)
  values (
    p_room_id,
    p_state,
    (p_state ->> 'currentTurnSeat')::smallint,
    case when v_room.host_mode = 'table' then v_room.host_user_id end
  )
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

revoke execute on function
  public.is_room_host(uuid),
  public.is_match_viewer(uuid),
  public.create_room(text),
  public.set_host_mode(uuid, text)
from public, anon, authenticated;

grant execute on function
  public.is_room_host(uuid),
  public.is_match_viewer(uuid),
  public.create_room(text),
  public.set_host_mode(uuid, text)
to authenticated;
