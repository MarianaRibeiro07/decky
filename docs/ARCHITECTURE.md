# Arquitetura

Estado: **implementado** e testado localmente (motor, SQL e validações). Falta verificar em 4 aparelhos com o Supabase real; ver "Deploy" abaixo.

## Visão geral

```
App (Expo, TypeScript, Expo Router)
  |  RPC (salas, mão própria)       Edge Functions (partida)
  |  create_room, join_room, ...    start-match, submit-action
  |  get_my_hand                     |
  |  leituras com RLS + Realtime     |  motor de regras (TypeScript puro)
  v                                  v
Supabase
  Auth ............ identidade (auth.users) e trigger que cria profiles
  PostgreSQL ...... tabelas, RLS, RPC transacional, schema private
  Edge Functions .. sorteio e regras; gravam via funções internas
  Realtime ........ avisa mudanças em rooms, room_players, matches (nunca mãos)
```

Princípios:

1. **O servidor é a fonte única da verdade.** O cliente envia uma intenção (`play_card`, `request_truco`, `respond_truco`, `fold`) e recebe projeções autorizadas.
2. **Nenhuma regra roda só no cliente.** O app usa `getLegalActions` do motor apenas para decidir quais botões mostrar; o servidor valida de novo com a mesma função.
3. **Segurança no servidor, não no visual.** A mão de outro jogador nunca sai do banco: fica em `private.private_hands` e só a própria mão é entregue por `get_my_hand`.
4. O dono da sala é só um papel administrativo. Nenhum celular executa regras.

## Mapa do código

| Caminho | O que é |
|---|---|
| `supabase/functions/_shared/engine/` | Motor do Truco Paulista: baralho, força, vazas, truco, placar. Sem I/O |
| `supabase/functions/start-match/` | Edge Function: sorteia e cria a partida (idempotente) |
| `supabase/functions/submit-action/` | Edge Function: valida a revisão, aplica a regra, grava |
| `supabase/functions/_shared/http.ts` | CORS, autenticação e cliente de serviço das funções |
| `supabase/migrations/` | Tabelas, RLS, RPCs de sala, funções internas, notas |
| `supabase/config.toml` | Declara as Edge Functions para o deploy pela integração GitHub |
| `src/contracts/types.ts` | Contratos (T-00). Tipos do jogo reexportados do motor |
| `src/rooms/` | API de salas e `useRoom` (lobby em tempo real) |
| `src/game/` | API da partida, `useMatch` (estado público + mão), textos da mesa |
| `src/lib/useLiveRefresh.ts` | Realtime + polling de segurança + recarga ao voltar do segundo plano |
| `src/history/` | Histórico e CRUD de notas |
| `src/auth/` | Sessão, cadastro, login e validação por REGEX |
| `src/ui/` | Tema, botão, campo, aviso, carta |
| `app/` | Telas (Expo Router) |
| `tests/engine/`, `tests/sql/`, `tests/app/` | Testes do motor, do banco (PGlite) e do app |

## Contratos

| Tipo | Papel | Sensível? |
|---|---|---|
| `Room`, `RoomSeat` | Sala (`lobby`, `playing`, `finished`) e posições 1 a 4, duplas A (1 e 3) e B (2 e 4) | Não |
| `PublicGameState` | Placar, vira, manilha, vez, valor da mão, truco pendente, cartas na mesa, vazas, última vaza e última mão | Não |
| `MatchView` | `PublicGameState` + `revision` + `roomCode` | Não |
| `PrivateHand` | `seat`, `cards`, `revision` do próprio usuário | **Sim** |
| `ActionRequest` | `{ matchId, action, expectedRevision, clientActionId }` | Não |
| `GameResult` | `{ ok: true, newRevision }` ou `{ ok: false, error }` | Não |

### Operações

| Operação | Tipo | Quem chama | Efeito |
|---|---|---|---|
| `create_room()` | RPC | autenticado | Cria sala com código de 6 caracteres e senta o dono no lugar 1 |
| `join_room(code)` | RPC | autenticado | Ocupa o primeiro lugar livre. Erros: `room_not_found`, `room_full`, `room_started`, `already_in_room` |
| `change_seat(room_id, seat)` | RPC | membro | Troca para lugar livre (`seat_taken` se ocupado) e zera o pronto |
| `set_ready(room_id, ready)` | RPC | membro | Marca pronto |
| `leave_room(room_id)` | RPC | membro | Sai no lobby; o dono passa a sala adiante; sala vazia é apagada |
| `start-match { roomId }` | Edge Function | dono | Idempotente; sorteia no servidor e grava mãos e vira |
| `get_my_hand(match_id)` | RPC | jogador | Devolve **somente** a própria mão |
| `submit-action { ... }` | Edge Function | jogador | Valida revisão e regra, grava evento e novo estado |
| CRUD de `match_notes` | tabela | autor | RLS por `author_user_id` e participação na partida |

As funções `internal_start_match`, `internal_get_match` e `internal_commit_action` só podem ser executadas por `service_role`, que existe apenas dentro das Edge Functions.

## Modelo de dados

| Tabela | Chaves e restrições principais | Visibilidade |
|---|---|---|
| `profiles` | PK `id` = `auth.users.id`; criado por trigger no cadastro | autenticados (só o nome) |
| `rooms` | PK `id`; `code` UNIQUE e CHECK de formato; FK `host_user_id` | membros da sala |
| `room_players` | PK `id`; FK `room_id`, `user_id`; UNIQUE `(room_id, user_id)` e `(room_id, seat)`; CHECK `seat` 1 a 4; `team` gerado pelo assento | membros da sala |
| `matches` | PK `id`; FK `room_id`; `public_state` jsonb; `revision`; placar; índice único de uma partida ativa por sala | membros da partida |
| `match_players` | PK `(match_id, user_id)`; UNIQUE `(match_id, seat)` | membros da partida |
| `match_events` | PK `id`; FK `match_id`, `actor_user_id`; UNIQUE `(match_id, client_action_id)` | membros da partida |
| `private.private_hands` | PK `(match_id, seat)`; schema sem GRANT para `anon`/`authenticated` | **ninguém direto** |
| `match_notes` | PK `id`; FK `match_id`, `author_user_id` | só o autor |

O cliente não tem `INSERT/UPDATE/DELETE` em nenhuma tabela, exceto `match_notes`. Placar só muda por `submit-action`.

## Ações no servidor

`submit-action`:

1. Valida o token do usuário (`auth.getUser`).
2. `internal_get_match`: confere que o usuário joga a partida e se o `clientActionId` já foi processado (**idempotência**: devolve o resultado anterior).
3. Compara `expectedRevision` com a revisão atual; diferente devolve `conflict` e o app recarrega.
4. `applyAction(estado, assento, ação)` do motor; regra violada devolve o motivo (`not_your_turn`, `invalid_card`, `illegal_action`).
5. `internal_commit_action`: trava a linha (`FOR UPDATE`), confere a revisão de novo, grava estado, mãos, evento e `revision + 1`. No fim da partida, a sala volta ao lobby.

`start-match` usa o índice único "uma partida ativa por sala" e a trava da sala: chamar duas vezes devolve a mesma partida.

## Realtime e reconexão

- O app assina `postgres_changes` em `rooms`, `room_players` e `matches` (com RLS). Um aviso de mudança só dispara uma **releitura**; nenhum dado chega pelo canal sem passar pelo RLS.
- A mão nunca está em subscription: o app chama `get_my_hand` quando a `revision` muda.
- Polling de segurança (3 a 4 s) e releitura ao voltar do segundo plano cobrem eventos perdidos. Reconectar só lê; ações não são reenviadas.
- Falha de rede ao enviar uma jogada: o app reenvia com o **mesmo** `clientActionId`, e o servidor não duplica.

## Deploy

O projeto Supabase está ligado ao repositório `rbrecci/Decky` pela integração GitHub. Quando estes arquivos chegam na branch de produção daquele repositório:

- as migrations de `supabase/migrations/` são aplicadas;
- as funções declaradas em `supabase/config.toml` são publicadas.

Configuração que **não** vem do repositório: em Authentication > Providers > Email, desligar "Confirm email" para a demonstração (senão o cadastro exige abrir o e-mail antes de entrar). O app trata os dois casos.

Plano B se a integração não publicar as funções: `npx supabase functions deploy start-match submit-action --project-ref yfijjtibyblzuplhtxbd` (pede `supabase login`).

## Modo mesa (P1)

**Não implementado.** Proposta mantida: tabela `room_viewers (room_id, user_id)` e políticas de leitura só do estado público; `get_my_hand` já devolve vazio para quem não está em `match_players`.

## O que não fazer

- Não distribuir cartas pelo cliente.
- Não publicar mãos em Realtime nem em coluna lida por todos.
- Não colocar `service_role` no app, no `.env.example` ou no Git.
- Não deixar o cliente enviar placar.
