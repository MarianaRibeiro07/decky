-- Decky: perfis, salas e posições.
-- Escrita só por RPC (security definer); o cliente lê com RLS.

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

-- Cria o perfil a partir dos dados do cadastro (display_name vem do app em options.data).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Garante o perfil de quem se cadastrou antes do trigger existir.
create or replace function public.ensure_profile(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.profiles (id, display_name)
  select u.id, left(coalesce(nullif(trim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)), 40)
  from auth.users u
  where u.id = p_user_id
  on conflict (id) do nothing;
$$;

-- ---------------------------------------------------------------------------
-- Salas e posições
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  -- 6 caracteres, sem 0/O/1/I para não confundir na leitura.
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  created_at timestamptz not null default now()
);

create table public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 1 and 4),
  -- Assentos alternados: 1 e 3 contra 2 e 4.
  team text generated always as (case when seat % 2 = 1 then 'A' else 'B' end) stored,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (room_id, user_id),
  unique (room_id, seat)
);

create index room_players_user_id_idx on public.room_players (user_id);

create or replace function public.is_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.room_players
    where room_id = p_room_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS: leitura para membros, nenhuma escrita direta.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;

create policy "perfis visíveis para usuários autenticados"
  on public.profiles for select to authenticated using (true);

create policy "sala visível para seus membros"
  on public.rooms for select to authenticated using (public.is_room_member(id));

create policy "posições visíveis para membros da sala"
  on public.room_players for select to authenticated using (public.is_room_member(room_id));

revoke all on public.profiles, public.rooms, public.room_players from anon, authenticated;
grant select on public.profiles, public.rooms, public.room_players to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de sala. Erros saem como códigos curtos; o app traduz para mensagens.
-- ---------------------------------------------------------------------------
create or replace function public.create_room()
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
  perform public.ensure_profile(v_user);

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;

  insert into public.rooms (code, host_user_id) values (v_code, v_user) returning * into v_room;
  insert into public.room_players (room_id, user_id, seat) values (v_room.id, v_user, 1);
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
  if exists (select 1 from public.room_players where room_id = v_room.id and user_id = v_user) then
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

create or replace function public.change_seat(p_room_id uuid, p_seat smallint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.rooms;
begin
  select * into v_room from public.rooms where id = p_room_id for update;
  if not found or not public.is_room_member(p_room_id) then
    raise exception 'room_not_found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started';
  end if;
  if p_seat not between 1 and 4 then
    raise exception 'invalid_seat';
  end if;
  if exists (select 1 from public.room_players where room_id = p_room_id and seat = p_seat) then
    raise exception 'seat_taken';
  end if;

  update public.room_players
  set seat = p_seat, ready = false
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

create or replace function public.set_ready(p_room_id uuid, p_ready boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_room_member(p_room_id) then
    raise exception 'room_not_found';
  end if;
  if (select status from public.rooms where id = p_room_id) <> 'lobby' then
    raise exception 'room_started';
  end if;

  update public.room_players
  set ready = p_ready
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

-- Sai da sala no lobby. Se o dono sair, a sala passa para quem entrou primeiro; vazia, é apagada.
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
  if not found or not public.is_room_member(p_room_id) then
    raise exception 'room_not_found';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'room_started';
  end if;

  delete from public.room_players where room_id = p_room_id and user_id = v_user;

  select user_id into v_next_host
  from public.room_players
  where room_id = p_room_id
  order by joined_at
  limit 1;

  if v_next_host is null then
    delete from public.rooms where id = p_room_id;
  elsif v_room.host_user_id = v_user then
    update public.rooms set host_user_id = v_next_host where id = p_room_id;
  end if;
end;
$$;

revoke execute on function
  public.handle_new_user(),
  public.ensure_profile(uuid),
  public.is_room_member(uuid),
  public.create_room(),
  public.join_room(text),
  public.change_seat(uuid, smallint),
  public.set_ready(uuid, boolean),
  public.leave_room(uuid)
from public, anon, authenticated;

grant execute on function
  public.is_room_member(uuid),
  public.create_room(),
  public.join_room(text),
  public.change_seat(uuid, smallint),
  public.set_ready(uuid, boolean),
  public.leave_room(uuid)
to authenticated;
