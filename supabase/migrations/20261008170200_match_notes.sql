-- Decky: notas pessoais do histórico (CRUD avaliado).
-- Cada nota pertence ao autor e aponta para uma partida da qual ele participou.
-- Editar nota nunca altera o resultado da partida: são tabelas separadas.

create table public.match_notes (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  author_user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index match_notes_author_idx on public.match_notes (author_user_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger match_notes_touch_updated_at
  before update on public.match_notes
  for each row execute function public.touch_updated_at();

alter table public.match_notes enable row level security;

create policy "autor lê as próprias notas"
  on public.match_notes for select to authenticated
  using (author_user_id = auth.uid());

create policy "autor cria nota em partida que jogou"
  on public.match_notes for insert to authenticated
  with check (author_user_id = auth.uid() and public.is_match_member(match_id));

create policy "autor edita as próprias notas"
  on public.match_notes for update to authenticated
  using (author_user_id = auth.uid())
  with check (author_user_id = auth.uid() and public.is_match_member(match_id));

create policy "autor exclui as próprias notas"
  on public.match_notes for delete to authenticated
  using (author_user_id = auth.uid());

revoke all on public.match_notes from anon, authenticated;
grant select, insert, update, delete on public.match_notes to authenticated;

revoke execute on function public.touch_updated_at() from public, anon, authenticated;
