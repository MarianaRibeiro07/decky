# Arquitetura

Estado: **implementado** e testado localmente (motor, SQL, fluxo das Edge Functions contra o banco e lógica da interface). Falta verificar em 4 ou 5 aparelhos com o Supabase real; ver "Deploy" abaixo.

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
4. O dono da sala é só um papel administrativo. Nenhum celular executa regras, nem no modo mesa.
5. Animação é representação. A distribuição animada e as cartas entrando na mesa só desenham o estado que o servidor já gravou; nenhuma regra espera uma animação terminar.

## Mapa do código

| Caminho | O que é |
|---|---|
| `supabase/functions/_shared/engine/` | Motor do Truco Paulista: baralho, força, vazas, truco, placar. Sem I/O |
| `supabase/functions/_shared/match-service.ts` | Núcleo das duas Edge Functions, sem Deno: valida o formato da ação, aplica o motor e grava pelas funções internas. Testado contra o banco em `tests/sql/flow.test.ts` |
| `supabase/functions/start-match/` | Edge Function (casca): autentica e chama `startMatchService` |
| `supabase/functions/submit-action/` | Edge Function (casca): autentica e chama `submitActionService` |
| `supabase/functions/_shared/http.ts` | CORS, autenticação e cliente de serviço das funções |
| `supabase/migrations/` | Tabelas, RLS, RPCs de sala, funções internas, notas |
| `supabase/config.toml` | Declara as Edge Functions para o deploy pela integração GitHub |
| `src/contracts/types.ts` | Contratos (T-00). Tipos do jogo reexportados do motor |
| `src/rooms/` | API de salas e `useRoom` (lobby em tempo real) |
| `src/game/` | API da partida, `useMatch` (estado público, mão e papel do aparelho), textos da mesa |
| `src/game/PlayerGame.tsx`, `src/game/TableGame.tsx` | As duas telas de partida: jogador (sem mesa dedicada: mesa em cima e mão embaixo; com mesa dedicada: só mão e essencial público) e mesa central (só público) |
| `src/game/components/` | `TableBoard` (mesa completa), `PlayerHud` (essencial público do jogador quando há mesa dedicada), `DealLayer` (distribuição animada), `ViraCard`, `SeatChip` (etiqueta do lugar), `PlayerIdentity` (avatar, selo da vez, cartas na mão, rótulo da dupla), `TrucoCallout` (aviso de pedido e aceite de truco), `ScoreBar`, `StatusBanner`, `HandPanel` (mão e controles), `FinishedOverlay` |
| `src/game/cue.ts` + `useTableCue.ts` | Qual aviso mostrar para a última ação confirmada e quando (puro e testado; o hook só cuida do tempo de exibição) |
| `src/game/calloutLayout.ts` | Medidas do aviso de truco para o espaço disponível (puro, testado: cabe no palco) |
| `src/rooms/SeatPicker.tsx` | Lugares da sala sobre a bandeja de feltro |
| `src/game/deal.ts`, `useDealAnimation.ts` | Ordem e cronograma da distribuição, a regra "anima uma vez por mão" e a fase calculada no render |
| `src/game/matchData.ts` | Junta cada leitura ao estado atual sem recriar o que não mudou (polling não redesenha) e descarta mão em aparelho que não é jogador |
| `src/game/geometry.ts` | Posições da mesa (puro, testado: nada se sobrepõe e tudo fica dentro da curva do feltro) |
| `src/game/controls.ts`, `status.ts` | Botões de truco legais e a linha de status (puros, testados) |
| `app/room/create.tsx` | Criar sala escolhendo o modo (dono joga ou é a mesa) |
| `app/dev/preview.tsx` | **Fixture local, só em desenvolvimento**: simula o servidor com o motor para ver a mesa sem Supabase |
| `src/lib/useLiveRefresh.ts`, `channelTopic.ts` | Realtime (um canal novo por montagem) + polling de segurança + recarga ao voltar do segundo plano |
| `src/lib/useRerenderAt.ts` | Redesenha nos instantes em que uma fase de animação muda (timers limpos ao desmontar) |
| `src/history/` | Histórico e CRUD de notas |
| `src/auth/` | Sessão, cadastro, login e validação por REGEX |
| `src/ui/` | Identidade visual: tokens (`theme.ts`), botão, campo, aviso, painel, carta, fundo do salão (`Backdrop`), ornamento de naipes e o tampo da mesa (`TableSurface`, `FeltPanel`) |
| `src/ui/shapes.ts` | Formato e medidas do tampo da mesa: superelipse, aro, trilho, feltro e área do conteúdo (puro, testado) |
| `app/` | Telas (Expo Router) |
| `tests/engine/`, `tests/sql/`, `tests/app/` | Testes do motor, do banco (PGlite) e do app |

## Contratos

| Tipo | Papel | Sensível? |
|---|---|---|
| `Room`, `RoomSeat` | Sala (`lobby`, `playing`, `finished`), `hostMode` (`player` ou `table`) e posições 1 a 4, duplas A (1 e 3) e B (2 e 4) | Não |
| `PublicGameState` | Placar, vira, manilha, vez, valor da mão, truco pendente, cartas na mesa, vazas, última vaza, última mão e `lastEvent` (última ação aceita, para os avisos de truco e a fala "Corro!") | Não |
| `MatchView` | `PublicGameState` + `revision` + `roomCode` + `tableUserId` | Não |
| `MatchRole` | `player` (está em `match_players`, tem mão) ou `table` (é o `table_user_id`) | Não |
| `PrivateHand` | `seat`, `cards`, `revision` do próprio usuário | **Sim** |
| `ActionRequest` | `{ matchId, action, expectedRevision, clientActionId }` | Não |
| `GameResult` | `{ ok: true, newRevision }` ou `{ ok: false, error }` | Não |

### Operações

| Operação | Tipo | Quem chama | Efeito |
|---|---|---|---|
| `create_room(p_host_mode = 'player')` | RPC | autenticado | Cria sala com código de 6 caracteres. Modo `player`: senta o dono no lugar 1. Modo `table`: o dono não ocupa lugar |
| `set_host_mode(room_id, mode)` | RPC | dono, no lobby | Troca o papel do dono: `table` libera o lugar dele; `player` o senta no primeiro lugar livre (`room_full` se não houver) |
| `join_room(code)` | RPC | autenticado | Ocupa o primeiro lugar livre. Erros: `room_not_found`, `room_full`, `room_started`, `already_in_room` (inclusive para o dono que é a mesa) |
| `change_seat(room_id, seat)` | RPC | membro | Troca para lugar livre (`seat_taken` se ocupado) e zera o pronto |
| `set_ready(room_id, ready)` | RPC | membro | Marca pronto |
| `leave_room(room_id)` | RPC | membro ou dono | Sai no lobby; o dono passa a sala adiante (que volta ao modo `player`); sem ninguém, a sala é apagada |
| `start-match { roomId }` | Edge Function | dono | Idempotente; sorteia no servidor e grava mãos e vira. No modo `table`, grava `matches.table_user_id` |
| `get_my_hand(match_id)` | RPC | jogador | Devolve **somente** a própria mão |
| `submit-action { ... }` | Edge Function | jogador | Valida revisão e regra, grava evento e novo estado |
| CRUD de `match_notes` | tabela | autor | RLS por `author_user_id` e participação na partida |

As funções `internal_start_match`, `internal_get_match` e `internal_commit_action` só podem ser executadas por `service_role`, que existe apenas dentro das Edge Functions.

## Modelo de dados

| Tabela | Chaves e restrições principais | Visibilidade |
|---|---|---|
| `profiles` | PK `id` = `auth.users.id`; criado por trigger no cadastro | autenticados (só o nome) |
| `rooms` | PK `id`; `code` UNIQUE e CHECK de formato; FK `host_user_id`; `host_mode` CHECK (`player`, `table`) | membros da sala e o dono |
| `room_players` | PK `id`; FK `room_id`, `user_id`; UNIQUE `(room_id, user_id)` e `(room_id, seat)`; CHECK `seat` 1 a 4; `team` gerado pelo assento | membros da sala |
| `matches` | PK `id`; FK `room_id`; `public_state` jsonb; `revision`; placar; FK `table_user_id` (mesa, ou null); índice único de uma partida ativa por sala | jogadores e mesa (`is_match_viewer`) |
| `match_players` | PK `(match_id, user_id)`; UNIQUE `(match_id, seat)` | jogadores e mesa |
| `match_events` | PK `id`; FK `match_id`, `actor_user_id`; UNIQUE `(match_id, client_action_id)` | jogadores e mesa |
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
- Uma leitura por vez; um pedido de leitura durante outra agenda mais uma ao final, para não perder a mudança logo depois de uma jogada. Leitura bem-sucedida tira o aviso "Sem conexão", mesmo com o Realtime caído (o polling cobre).
- Leitura igual à anterior (mesma revisão) devolve o mesmo objeto de estado (`mergeMatchData`), então polling e avisos repetidos do Realtime não redesenham a partida. Leitura atrasada nunca volta para uma revisão mais antiga.
- Cada montagem da tela assina um canal com nome único (`channelTopic`). O `supabase.channel(nome)` devolve o canal existente com o mesmo nome e `removeChannel` é assíncrono; com nome fixo, sair e voltar rápido para a partida lançava `cannot add postgres_changes callbacks after subscribe()`.
- A tela da partida fica acesa (`useScreenAwake`), importante para a mesa central.

## Deploy

O projeto Supabase está ligado ao repositório `rbrecci/Decky` pela integração GitHub. Quando estes arquivos chegam na branch de produção daquele repositório:

- as migrations de `supabase/migrations/` são aplicadas;
- as funções declaradas em `supabase/config.toml` são publicadas.

Configuração que **não** vem do repositório: em Authentication > Providers > Email, desligar "Confirm email" para a demonstração (senão o cadastro exige abrir o e-mail antes de entrar). O app trata os dois casos.

**Esta versão exige:** aplicar a migration `20261008180000_table_mode.sql` e **republicar as duas Edge Functions** (o código delas passou a importar `_shared/match-service.ts`). Sem a migration, criar sala no modo mesa falha; sem republicar as funções, o modo mesa funciona, mas as falas de truco (`lastEvent`) não aparecem e a validação de formato continua a antiga.

Plano B se a integração não publicar as funções: `npx supabase functions deploy start-match submit-action --project-ref yfijjtibyblzuplhtxbd` (pede `supabase login`).

## Modos de host

O dono escolhe ao criar a sala (`app/room/create.tsx`) e pode trocar no lobby, antes de iniciar.

| | Modo `player` (4 aparelhos) | Modo `table` (5 aparelhos) |
|---|---|---|
| Dono | Ocupa um dos 4 lugares e joga | Não ocupa lugar, não tem mão, não joga |
| Tela do dono | Mesa em cima, mão embaixo (`PlayerGame`) | Mesa central em tela cheia (`TableGame`) |
| Tela dos jogadores | `PlayerGame`: mesa completa em cima, mão embaixo | `PlayerGame` com `PlayerHud`: mão maior, controles e só o essencial público (placar, valor, vez, vira e manilha, truco, quem já jogou). **Sem** a mesa completa: as cartas jogadas aparecem só na mesa central |
| `matches.table_user_id` | null | id do dono |

Segurança do modo mesa, garantida no banco (testada em `tests/sql/table-mode.test.ts` e `tests/sql/flow.test.ts`):

- A mesa lê `matches`, `match_players` e `match_events` por `is_match_viewer` (jogador **ou** `table_user_id`). Nada além do estado público.
- `get_my_hand` devolve `null` para a mesa: ela não está em `private.private_hands`. O app nem pede: só chama `get_my_hand` se o usuário está em `match_players`, e `mergeMatchData` descarta qualquer mão num aparelho que não é jogador.
- O papel do aparelho vem só de `match_players` e de `table_user_id` (`resolveRole`); receber uma mão não transforma ninguém em jogador.
- O Realtime publica só `rooms`, `room_players` e `matches`; nem `private.private_hands` nem `match_events` (teste em `tests/sql/table-mode.test.ts`). Nem a `service_role` lê o schema `private` direto: só as funções `security definer`.
- `internal_get_match` exige estar em `match_players`, então `submit-action` responde `not_member` a qualquer ação da mesa.
- O dono administra a sala (iniciar, trocar o modo), mas o servidor não depende do aparelho dele: se a mesa fechar o app, a partida segue nos 4 celulares.

O app decide qual tela mostrar pelo que o servidor entregou (`resolveRole` e `playerLayout` em `src/game/role.ts`), nunca por parâmetro de rota.

## Mesa e distribuição animada

`TableBoard` desenha a mesa completa: na mesa central (`large`) e, quando não há mesa dedicada, na metade de cima do jogador (`compact`). As posições vêm de `tableGeometry`, que garante que lugares, cartas jogadas, baralho, vira e selo da manilha não se sobrepõem e que **os quatro cantos de cada caixa ficam dentro da curva do feltro**, com folga (teste em `tests/app/table.test.ts`, em nove tamanhos de tela). Quem olha fica sempre embaixo; a mesa central põe o lugar 1 embaixo.

Layout responsivo da mesa:

- O conteúdo fica dentro do feltro (`surfaceMetrics(...).content` é o próprio feltro). Antes ele avançava sobre o aro, e as etiquetas perto dos cantos passavam por cima do trilho e do couro.
- A mesa é uma superelipse: a borda "entra" perto dos cantos, e mais fundo quanto maior a mesa. `tableGeometry` recebe o expoente da forma e recua as etiquetas de cima e de baixo e as colunas laterais pela profundidade da curva sob os cantos (`superellipseDepth`). Um recuo fixo só funcionava num tamanho.
- Etiquetas em cima e embaixo são largas (avatar ao lado do nome); nas laterais, estreitas e em coluna (avatar em cima). A altura da etiqueta lateral se adapta à altura da mesa; na mesa dedicada baixa, as de cima e de baixo também ficam mais baixas.
- `stage` é o palco do centro (entre as quatro cartas jogadas, onde ficam baralho e vira). Os avisos de truco aparecem só ali, sem cobrir carta jogada nem etiqueta.
- O banner de status tem altura fixa (linha principal + uma linha de complemento): se crescesse, a mesa encolheria e tudo mudaria de lugar justo no pedido de truco. Frases curtas usam o primeiro nome.
- No aparelho da mesa com menos de 720 pt de altura, placar e banner usam o tamanho compacto, para a mesa ficar com a altura.

Distribuição (`src/game/deal.ts`, animada com React Native Reanimated):

1. O servidor já embaralhou e gravou as mãos quando o app recebe a mão nova (`handNumber` novo, sem carta jogada).
2. A partir da 2ª mão, uma pausa curta mostra a última vaza e o resultado da mão anterior.
3. As 12 cartas saem do baralho (verso `assets/Fundo-Carta-Vermelho.png`) na ordem real: começando à direita de quem embaralhou, uma por vez, três voltas.
4. Cada carta da própria mão aparece quando a carta voadora correspondente pousa.
5. A vira vira de face; depois aparece o selo da manilha; então a vez é destacada.
6. Cada manilha da própria mão ganha a revelação especial (ver "Manilha na mão").

Regras da animação:

- **Uma vez por mão e por aparelho** (`dealTracker`): Realtime repetido, polling, reconexão ou remontagem da tela não repetem a distribuição; remontar no meio a retoma do ponto em que estava.
- **Entrar no meio da mão não anima** (já há carta jogada): a tela mostra o estado direto.
- Nenhuma regra depende do fim da animação. Durante ela o app só segura os toques do próprio jogador (cerca de 1,5 s); o servidor já aceita jogadas.
- Respeita "reduzir movimento" do aparelho (padrão do Reanimated): as cartas não voam, mas a mão e a vira aparecem normalmente.
- **A fase é calculada no render** a partir do relógio (`dealPhaseNow`, `arrivedCards`); `useRerenderAt` só agenda o redesenho nas trocas de fase. Antes a fase vinha de um `useEffect`, e o primeiro quadro de cada mão nova saía com a mão e a vira abertas antes de a animação começar.
- A vira só gira durante a etapa `reveal` (componente montado só nela, começando do verso); fora dela é uma carta estática.
- Cartas na mesa têm chave pela própria carta (`playedCardKey`): quando a vaza fecha, as três primeiras esmaecem no lugar e só a quarta entra voando. Ao abrir a tela ou reconectar, `LayoutAnimationConfig skipEntering` mostra o que já estava na mesa e na mão sem refazer as entradas.
- Na mão, a animação de layout fica num invólucro e o deslocamento da carta selecionada numa view interna (o Reanimated avisava que o `transform` seria sobrescrito).

## Manilha na mão

`src/game/manilha.ts` (puro, testado em `tests/app/manilha.test.ts`) e `ManilhaReveal`:

- **Identificação:** `card.rank === manilhaRank`, a mesma regra do motor. A manilha vem do estado público (calculada pelo motor a partir da vira) e as cartas, da mão privada que só o dono recebe. Nada novo é enviado a nenhum aparelho; a mesa central nunca tem mão, então nunca anima nem destaca manilha.
- **Destaque permanente:** contorno e halo dourados e um selo (medalha escura com estrela) no canto superior direito, metade para fora da carta, sem cobrir valor nem naipe. A estrela marca a manilha pela forma, não só pela cor, e o leitor de tela diz "rei de paus, manilha". Só aparece com a vira aberta (antes, a mão mostrava "★ manilha" escrito embaixo da carta assim que ela chegava, antes de a vira virar).
- **Revelação:** o brilho dourado sobe na carta, a estrela surge girando no centro, há um pico com onda de luz e faíscas e depois a dissipação; fica o destaque permanente. 1,5 s por manilha, escalonadas em 0,6 s da esquerda para a direita (os picos nunca coincidem; três manilhas terminam ~2,9 s depois da vira). Não bloqueia nada: a carta segue selecionável e jogável durante o efeito.
- **Sem repetição:** os horários saem do `dealTracker` (a mesma execução da distribuição), não da renderização. Render repetido, sincronização, volta à tela e reconexão devolvem os mesmos horários; depois do fim, nada é montado. Entrar no meio da mão não anima. Remontar no meio retoma do ponto. O plano fica fixo depois de feito, então jogar uma manilha no meio não reescalona as outras.
- **Desempenho:** camadas SVG estáticas (halo radial, contorno, onda, brilho em cruz, quatro faíscas, estrela com degradê) dentro de `Animated.View`; só opacidade, escala e rotação animam, na thread de UI, guiadas por um único valor de progresso. Com "reduzir movimento" ligado, o efeito não é montado.

## Jogada e controles

- Tocar numa carta a seleciona (sobe e ganha borda: vermelha com brilho quando dá para jogar agora, metálica quando ainda não é a vez); "Jogar" ou um segundo toque confirma. Dá para pré-selecionar fora da vez.
- Fileira de ações, da esquerda para a direita: Correr (contorno, bandeira, longe do polegar), Pedir truco (bronze, setas) e Jogar (laca vermelha, maior, à direita: ação principal). Ícones em SVG (`src/ui/icons.tsx`) em cima do rótulo, para os três caberem numa linha num iPhone SE. O botão de jogar diz por que está parado: "Distribuindo…", "Aguarde a vez" ou "Escolha a carta".
- Uma trava síncrona impede dois envios por toque duplo; o servidor também é idempotente pelo `clientActionId`.
- Os botões de truco vêm de `trucoControls`, espelho de `getLegalActions`: pedir (TRUCO, SEIS, NOVE ou DOZE, conforme o valor) e, para a dupla que responde, Aceitar, Correr e Pedir o próximo valor. A dupla que pediu vê "Aguardando a outra dupla responder". Correr sem pedido pendente pede confirmação.
- A carta jogada entra na mesa vindo do lado de quem jogou; a vencedora da vaza é destacada quando a mesa limpa.
- A vez é destacada (contorno e avatar dourados, selo "VEZ") só quando não há pedido de truco pendente (`activeTurnSeat`), igual na mesa e no painel do jogador. O brilho entra uma vez e fica parado: não pulsa.

## Avisos de truco

Pedido (3, 6, 9, 12) e aceite aparecem como uma plaquinha no palco do centro da mesa (`TrucoCallout`) e, com mesa dedicada, também ao lado da vira no painel do jogador. "Corro!" continua como fala curta junto de quem correu.

| Evento | Visual |
|---|---|
| Pedido / aumento | Laca vermelha do logo: medalhão creme com o valor, "BIA PEDE" (ou "AUMENTA"), o nome do pedido e a escada da aposta (quatro losangos: 3, 6, 9, 12, preenchidos até o valor). Entra vindo do lado de quem pediu; o medalhão estoura com ondas. A cada degrau o estouro fica um pouco maior e há uma onda a mais: mesma linguagem, intensidade proporcional |
| Aceite | Selo dourado: o medalhão mostra o valor que a mão passou a valer, "ACEITO!" e a escada em dourado. Desce como carimbo e um brilho atravessa a plaquinha. No placar, "Vale 6" entra com um leve salto |

Sincronização (`src/game/cue.ts`, `useTableCue`):

- O aviso sai do `lastEvent` **conferido com o estado que veio junto**: pedido só com pedido pendente; aceite só com o pedido já resolvido e o novo valor em `handValue`. Nada aparece antes de o servidor confirmar.
- Cada revisão anuncia no máximo uma vez (a revisão é a chave do componente). Revisão nova substitui o aviso anterior na hora, então a ordem é a do servidor (pedido, depois aceite).
- Primeira leitura da tela, leitura que recupera uma queda de conexão e salto de mais de 3 revisões (app voltou do segundo plano) não anunciam: evento velho não é reapresentado.
- O tempo de exibição (2,6 s para pedido, 2,2 s para aceite) é só apresentação: nada no jogo espera por ele, os controles continuam livres, e o fim vem de `useRerenderAt` (timer limpo ao desmontar). Durante a distribuição o aviso não aparece.
- As animações rodam uma vez, na thread de UI, só com `withTiming`: com "reduzir movimento" ligado, `withSpring` não avançava no web e o aviso ficava invisível. Nesse modo o aviso aparece direto, sem movimento.
- O tamanho da plaquinha sai de `calloutLayout`: em linha quando há largura, empilhado no palco estreito, e sem medalhão quando o palco é muito baixo (o título já diz o pedido). Um teste confere que tudo cabe no palco em seis tamanhos de mesa.

## Identidade visual

Cassino reservado: preto e grafite dominam, a mesa é o destaque. O logo (`assets/Decky-Logo.png`) é usado sem alteração; o creme, o vermelho e o contorno quase preto dele são as cores de acento, e o dourado envelhecido (`colors.gold`) aparece só em pontos de estado: vez de jogar, manilha, vencedor da vaza e partida ganha.

| Peça | Como é feita |
|---|---|
| Tokens | `src/ui/theme.ts`: cores (fundo, superfícies, texto, logo, dourado, mesa, duplas), fontes, tamanhos, espaços, raios e sombras. Telas não definem cores soltas |
| Tipografia | Playfair Display (`@expo-google-fonts/playfair-display`, pesos 700 e 900) em títulos, saudação e números do placar, com `fontVariant: ['lining-nums']` para os algarismos ficarem alinhados. Textos funcionais, botões e cartas ficam na fonte do sistema. A fonte é carregada em `app/_layout.tsx`; se falhar, o app segue com a do sistema |
| Mesa | `TableSurface` desenha em SVG (`react-native-svg`, já usado no projeto) o tampo em superelipse: lateral visível embaixo (espessura), aro de couro com costura e reflexo da luminária, trilho metálico, feltro carvão com luz no centro, textura (`assets/textures/felt.png`, 128 px que repete sem emenda) e sombra interna do trilho. É estático e memorizado por tamanho. `surfaceMetrics` diz onde fica o feltro; o `TableBoard` posiciona lugares e cartas nessa área com a mesma `tableGeometry` de antes |
| Baralho | Faces de Byron Knoll em papel marfim (não branco puro, que ofuscava sobre o preto) e verso do grupo na mesma proporção das faces (500 x 726). `scripts/build_cards.py` aplica o tom e reduz a paleta com pontilhado: o baralho caiu de 4,0 MB para 1,5 MB sem faixas nos degradês. A moldura (`PlayingCard`) tem raio proporcional à largura (`cardRadius`), igual ao canto desenhado na arte |
| Cartas na mesa | Sombra curta de apoio (`boxShadow`) e leve inclinação por lugar (só `rotate`, sem deformar). A inclinação fica numa view interna para não brigar com a animação de entrada |
| Profundidade | Sem engine 3D nem perspectiva real: a perspectiva distorceria as cartas e complicaria o toque. A sensação de objeto físico vem da lateral do tampo, das sombras e da luz. Pés da mesa não aparecem porque o enquadramento é de cima |
| Telas | `Screen` (fundo `Backdrop` + título com filete dourado), `Panel` (superfície grafite), `Button` (`primary` laca vermelha, `dark` grafite, `secondary` contorno, `gold` bronze, `ghost` só texto; estados pressionado, desabilitado e carregando) e `FeltPanel` (bandeja de feltro do HUD e do lobby, em retângulo com cantos de raio fixo: assim o recuo do conteúdo vale em qualquer tamanho) |
| Jogadores | Avatar em forma de ficha de cassino (`PlayerAvatar`): aro na cor da dupla, iniciais em creme na Playfair; na vez, aro dourado. Nome em destaque (reticências quando não cabe, ou até duas linhas na sala), dupla em versalete na cor da dupla e cartas na mão como três silhuetas (cheias as que restam), no lugar dos versos em miniatura, que ficavam ilegíveis |

Sombras usam `boxShadow`, que no React Native 0.86 funciona no Android e no iOS (nova arquitetura). Cartas voando na distribuição não têm sombra, para não pesar.

Custo da borda da mesa: o aro tira espaço das cartas, e agora nada avança sobre ele (antes as plaquinhas dos lugares ficavam sobre o couro e passavam do trilho perto dos cantos). Para compensar, o aro ficou um pouco mais fino e as etiquetas de cima e de baixo, mais baixas. Medido com `tableGeometry`: a carta da mesa dedicada em 395 x 560 tem cerca de 71 pt de largura; o teste mantém o mínimo de 38 pt no celular pequeno (344 x 250, metade de cima).

## Desempenho

Gargalos encontrados e corrigidos (outubro/2026):

| Gargalo | Correção |
|---|---|
| Polling de 4 s e Realtime recriavam o estado e redesenhavam a partida inteira a cada leitura, mesmo sem mudança | `mergeMatchData` reaproveita objetos; leitura igual não gera render |
| Selecionar carta, enviar jogada ou mostrar erro redesenhava a mesa e o placar | `TableBoard`, `ScoreBar` e `PlayerHud` com `memo`; `leaveTable` estável |
| Verso da carta de 1024 x 1536 (2,2 MB) decodificado em até ~25 imagens durante a distribuição | `assets/cards/back.png`, 400 x 600 (0,35 MB) |
| Canal Realtime reaproveitado ao remontar a tela (erro e assinatura perdida) | Nome de canal único por montagem |
| Mesa com materiais realistas sem custo por quadro | Tampo em SVG estático com `memo` (redesenha só quando o tamanho muda), textura de 20 KB, nenhum filtro de desfoque; a seleção da carta anima na thread de UI (Reanimated) |

A versão das bibliotecas de animação é a que o Expo 57 espera (`react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1; `npx expo install --check` sem pendências), e o `babel-preset-expo` já inclui o plugin de worklets: não há `babel.config.js` a configurar.

## O que não fazer

- Não distribuir cartas pelo cliente.
- Não publicar mãos em Realtime nem em coluna lida por todos.
- Não colocar `service_role` no app, no `.env.example` ou no Git.
- Não deixar o cliente enviar placar.
