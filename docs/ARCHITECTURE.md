# Arquitetura

Estado: **proposta de planejamento**. Nada abaixo está implementado. Os contratos viram definitivos quando T-00 for aprovado por Caio, Eduardo e Rafael.

## Visão geral

```
App (Expo, TypeScript, Expo Router)
  |  intenções: start_match, submit_action, get_my_hand
  |  leituras:  estado público (Realtime), próprias notas
  v
Supabase
  Auth ............ identidade (auth.users)
  PostgreSQL ...... tabelas, RLS, RPC transacional
  Edge Functions .. motor de regras (applyAction) quando a lógica não couber em SQL
  Realtime ........ somente eventos públicos
```

Princípios:

1. **O servidor é a fonte única da verdade.** O cliente envia uma intenção (`play_card`, `request_truco`, `respond_truco`, `fold`) e recebe projeções autorizadas.
2. **Nenhuma regra roda só no cliente.** Validação de turno, posse de carta, truco e placar acontece no servidor.
3. **Segurança no servidor, não no visual.** Esconder a carta adversária na tela não protege nada se ela trafega para o aparelho. O que é privado nunca sai do banco para quem não é o dono.
4. O dono da sala ("host") é só um papel administrativo. Nenhum celular executa regras nem precisa ficar ativo para a partida continuar.

## Cliente

- Expo Router: rotas por arquivo em `app/` (`(auth)`, `room`, `game`, `history`).
- Estado do servidor entra por hooks (`useRoom`, `usePublicState`); componentes de tela não chamam o Supabase diretamente.
- Somente `EXPO_PUBLIC_SUPABASE_URL` e a chave publishable/anon existem no app. `service_role` nunca.

## Contratos (T-00)

Tipos em `src/contracts/types.ts`; as RPCs são a fronteira cliente-servidor.

| Tipo | Papel | Sensível? |
|---|---|---|
| `UserProfile` | `id`, `displayName` | Não |
| `Room` | `id`, `code`, `hostUserId`, `status` (`lobby`, `playing`, `finished`) | Não |
| `RoomSeat` | `seat` (1 a 4), `team` (`A`, `B`), `userId`, `ready` | Não |
| `PublicGameState` | placar, vira, manilha, vez, cartas na mesa, estado do truco, `revision` | Não |
| `PrivateHand` | as 3 cartas do próprio usuário, `matchId`, `revision` | **Sim** |
| `GameAction` | `{ matchId, type, payload, expectedRevision, clientActionId }` | Não |
| `GameResult` | `{ ok, newRevision } ou { ok: false, error }` | Não |

Operações (assinaturas a ratificar):

| Operação | Quem chama | Efeito |
|---|---|---|
| `create_room()` | autenticado | cria sala e posição do dono |
| `join_room(code, seat)` | autenticado | ocupa posição livre |
| `set_ready(room_id, ready)` | jogador | marca pronto |
| `start_match(room_id, clientActionId)` | dono | idempotente; sorteia e grava mãos e vira |
| `get_my_hand(match_id)` | jogador | devolve **somente** a própria mão |
| `submit_action(action)` | jogador | valida, aplica, grava evento e novo estado |
| CRUD de `match_notes` | autor | RLS por `author_user_id` |

## Modelo de dados inicial

Segue o SPEC, seção 7. Tabelas obrigatórias para a avaliação (duas relacionadas por PK/FK): `rooms` e `room_players`, mais `matches` e `match_notes`.

| Tabela | Chaves e restrições principais | Visibilidade |
|---|---|---|
| `profiles` | PK `id` = `auth.users.id` | pública para membros da sala (nome) |
| `rooms` | PK `id`; `code` UNIQUE; FK `host_user_id` | membros da sala |
| `room_players` | PK `id`; FK `room_id`, `user_id`; UNIQUE `(room_id, user_id)` e `(room_id, seat)`; CHECK `seat` entre 1 e 4 | membros da sala |
| `matches` | PK `id`; FK `room_id`; `revision`; placar; `winner_team` | membros da partida |
| `match_players` | PK `(match_id, user_id)` | membros da partida |
| `match_events` | PK `id`; FK `match_id`, `actor_user_id`; `payload_public` | membros da partida |
| `private.private_hands` | PK `(match_id, user_id)`; cartas | **privada** |
| `match_notes` | PK `id`; FK `match_id`, `author_user_id` | só o autor |

### Público x privado

- `private_hands` fica em um **schema não exposto** (`private`), sem `GRANT` para `anon` nem `authenticated`. A única porta é `get_my_hand`, `SECURITY DEFINER`, que filtra por `auth.uid()`.
- `match_events.payload_public` guarda apenas fatos públicos (carta jogada, pedido de truco). O Realtime por tabela envia a linha inteira, então **nada sensível pode entrar nessa coluna**.
- Placar e `current_turn_user_id` só mudam por `submit_action`; as tabelas não têm `UPDATE` direto para o cliente.

### RLS (política mínima)

- Salas e posições: leitura para membros; escrita só via RPC.
- Partidas, eventos, jogadores: leitura para membros da partida; nenhuma escrita direta.
- `match_notes`: `SELECT/INSERT/UPDATE/DELETE` onde `author_user_id = auth.uid()`; a nota só aponta para partida da qual o usuário participou.
- Cada política precisa de teste com dois tokens (ver [QA_DEMO.md](QA_DEMO.md)).

## Ações no servidor

`submit_action` roda em uma transação:

1. Trava a linha de `matches` (`FOR UPDATE`).
2. Compara `expectedRevision` com `revision`; diferente devolve conflito.
3. Confere `clientActionId` em `match_events`; repetido devolve o resultado anterior (**idempotência**).
4. Lê a mão privada do ator e chama `applyAction(state, action)` do motor.
5. Grava evento público, novo estado e `revision + 1`.

`start_match` usa a mesma ideia: chave de idempotência por sala, para não criar duas partidas.

## Motor de regras

TypeScript puro em `supabase/functions/_shared/engine/` (sugestão), com testes unitários rodando fora do Supabase. A fachada `applyAction` não faz I/O. **A verificar em T-00:** se o bundler das Edge Functions resolve imports desse caminho a partir dos testes na raiz. Alternativa se não resolver: copiar o motor por script de build.

## Realtime

- Assinar apenas tabelas públicas (`rooms`, `room_players`, `matches`, `match_events`) com RLS ligado.
- Mão privada nunca em subscription; o app a busca por `get_my_hand` ao entrar na partida e quando a `revision` muda.
- Ao reconectar: recarregar `matches` e `get_my_hand`, depois reassinar. Ações pendentes reenviam o mesmo `clientActionId`.

## Modo mesa (P1) e questão em aberto

O quinto aparelho precisa de identidade para ler dados protegidos por RLS. Duas opções, decisão de Caio e Rafael em T-00: (a) conta normal, com tabela `room_viewers (room_id, user_id)` e políticas de leitura só do estado público; (b) login anônimo do Supabase com a mesma tabela. Em ambas, `get_my_hand` devolve vazio para quem não está em `match_players`.

## O que não fazer

- Não distribuir cartas pelo cliente.
- Não publicar todas as mãos em Realtime nem em coluna lida por todos.
- Não colocar `service_role` no app, no `.env.example` ou no Git.
- Não deixar o cliente enviar placar.
