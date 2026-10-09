-- Decky: carta escondida (D-20 a D-22), jogada automática (D-23, D-24) e prazo de 20 s (D-25 a D-28).
-- A carta escondida e a carta marcada ficam só em private.private_hands: nada disso vai para o
-- estado público, para o Realtime ou para match_events. Um único relógio: o do Postgres.

alter table private.private_hands
  add column covered jsonb,
  add column auto_card jsonb;

-- Relógio do servidor em epoch ms. O app usa para acertar a diferença com o relógio do aparelho.
create or replace function public.server_now()
returns double precision
language sql
volatile
set search_path = ''
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000);
$$;

-- A própria mão, agora com a carta escondida na mesa e a carta marcada (só de quem chama).
create or replace function public.get_my_hand(p_match_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'revision', m.revision,
    'seat', h.seat,
    'cards', h.cards,
    'covered', h.covered,
    'autoCard', h.auto_card
  )
  from private.private_hands h
  join public.matches m on m.id = h.match_id
  where h.match_id = p_match_id and h.user_id = auth.uid();
$$;

-- Estado completo para o motor, agora com covered, autoCards e o relógio do banco.
create or replace function public.internal_get_match(
  p_match_id uuid,
  p_user_id uuid,
  p_client_action_id text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_seat smallint;
  v_done_revision integer;
  v_hands jsonb;
  v_covered jsonb;
  v_auto jsonb;
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

  select jsonb_agg(cards order by seat), jsonb_agg(covered order by seat), jsonb_agg(auto_card order by seat)
  into v_hands, v_covered, v_auto
  from private.private_hands where match_id = p_match_id;

  return jsonb_build_object(
    'ok', true,
    'duplicate', false,
    'seat', v_seat,
    'revision', v_match.revision,
    'state', v_match.public_state,
    'hands', v_hands,
    'covered', v_covered,
    'autoCards', v_auto,
    'now', public.server_now()
  );
end;
$$;

-- O commit passa a gravar a carta escondida, as marcações e uma lista de eventos (a ação pedida e as
-- jogadas automáticas que vieram em cadeia). Uma assinatura só: a antiga é removida.
drop function public.internal_commit_action(uuid, uuid, integer, jsonb, jsonb, jsonb, text);

create function public.internal_commit_action(
  p_match_id uuid,
  p_user_id uuid,
  p_expected_revision integer,
  p_state jsonb,
  p_hands jsonb,
  p_covered jsonb,
  p_auto_cards jsonb,
  p_auto_used jsonb,
  p_events jsonb,
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
  v_event jsonb;
  v_first boolean := true;
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

  -- Alguém marcou ou cancelou a jogada automática entre a leitura e o commit (set_my_auto_card não
  -- muda a revisão): nada é gravado e o serviço refaz a ação com a marcação nova.
  if exists (
    select 1 from private.private_hands h
    where h.match_id = p_match_id
      and h.auto_card is distinct from nullif(p_auto_used -> (h.seat - 1), 'null'::jsonb)
  ) then
    return jsonb_build_object('ok', false, 'error', 'auto_changed');
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

  update private.private_hands h set
    cards = p_hands -> (h.seat - 1),
    covered = nullif(p_covered -> (h.seat - 1), 'null'::jsonb),
    auto_card = nullif(p_auto_cards -> (h.seat - 1), 'null'::jsonb)
  where h.match_id = p_match_id;

  -- O clientActionId fica no primeiro evento (a ação pedida): é ele que torna o reenvio idempotente.
  for v_event in select value from jsonb_array_elements(p_events) loop
    insert into public.match_events (match_id, actor_user_id, action, payload_public, revision, client_action_id)
    values (
      p_match_id,
      p_user_id,
      v_event ->> 'action',
      v_event,
      v_new_revision,
      case when v_first then p_client_action_id end
    );
    v_first := false;
  end loop;

  if v_finished then
    update public.rooms set status = 'lobby' where id = v_match.room_id;
    update public.room_players set ready = false where room_id = v_match.room_id;
  end if;

  return jsonb_build_object('ok', true, 'newRevision', v_new_revision, 'duplicate', false);
end;
$$;

-- Marca (ou cancela, com null) a carta da própria mão para jogada automática (D-23).
-- Não muda a revisão nem gera evento: ninguém mais fica sabendo, e nenhuma jogada recebe conflito.
-- Trava a partida, então fica em ordem com o commit de quem estiver jogando agora.
create or replace function public.set_my_auto_card(p_match_id uuid, p_card jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches;
  v_hand private.private_hands;
  v_state jsonb;
  v_card jsonb := nullif(p_card, 'null'::jsonb);
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'match_not_found');
  end if;

  select * into v_hand from private.private_hands where match_id = p_match_id and user_id = auth.uid();
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_member');
  end if;

  if v_match.status <> 'playing' then
    return jsonb_build_object('ok', false, 'error', 'match_over');
  end if;

  if v_card is not null then
    if jsonb_typeof(v_card) <> 'object' then
      return jsonb_build_object('ok', false, 'error', 'bad_request');
    end if;
    v_card := jsonb_build_object('rank', v_card ->> 'rank', 'suit', v_card ->> 'suit');
    if not (v_hand.cards @> jsonb_build_array(v_card)) then
      return jsonb_build_object('ok', false, 'error', 'invalid_card');
    end if;
    -- Na própria vez, com jogada livre (sem truco nem pedido da dupla), vale a jogada normal.
    v_state := v_match.public_state;
    if (v_state ->> 'currentTurnSeat')::smallint = v_hand.seat
      and jsonb_typeof(v_state -> 'truco') is distinct from 'object'
      and jsonb_typeof(v_state -> 'proposal') is distinct from 'object' then
      return jsonb_build_object('ok', false, 'error', 'illegal_action');
    end if;
  end if;

  update private.private_hands set auto_card = v_card
  where match_id = p_match_id and seat = v_hand.seat;

  return jsonb_build_object('ok', true, 'autoCard', coalesce(v_card, 'null'::jsonb));
end;
$$;

revoke execute on function
  public.server_now(),
  public.internal_get_match(uuid, uuid, text),
  public.internal_commit_action(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text),
  public.set_my_auto_card(uuid, jsonb)
from public, anon, authenticated;

grant execute on function public.server_now(), public.set_my_auto_card(uuid, jsonb) to authenticated;

grant execute on function
  public.server_now(),
  public.internal_get_match(uuid, uuid, text),
  public.internal_commit_action(uuid, uuid, integer, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text)
to service_role;
