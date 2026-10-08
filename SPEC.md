# Decky: Especificação do MVP

**Versão:** 1.0 (planejamento)

**Data-alvo de demonstração:** 09/10/2026

**Repositório:** https://github.com/MarianaRibeiro07/decky

## 1. Visão e problema

O Decky é um aplicativo mobile que substitui as cartas físicas em partidas **presenciais** de Truco Paulista. Quatro pessoas, em duas duplas, compartilham uma sala pela internet; cada jogador vê apenas suas cartas, enquanto todos acompanham a mesa, a vira, as manilhas, os turnos, os pedidos de truco e a pontuação. A interface deve ser simples, com botões grandes, contraste forte, poucos textos, naipes e figuras tradicionais de baralho, adequada também a pessoas mais velhas.

**MVP:** partida completa, automática, demonstrável em quatro aparelhos; um quinto aparelho pode atuar opcionalmente como mesa, sem ver cartas privadas.

## 2. Equipe

| Pessoa | Papel | Responsabilidade principal |
|---|---|---|
| Mariana Ribeiro | Product Owner | Prioridades, histórias, critérios de aceite, testes de aceitação e demonstração |
| Isabela Puzenato | Scrum Master | Scrum, board/issues, impedimentos, integração do trabalho e evidências |
| Nicoly Ribeiro | Dev | Design system, fluxo de cadastro/login, navegação e acessibilidade |
| Caio Yuri | Dev | Lobby, salas, posições, presença e sincronização/reconexão |
| Eduardo Zanetti | Dev | Motor de regras de Truco Paulista, validação de jogadas e testes |
| Rafael Brecci | Dev | Supabase, modelagem SQL, políticas de acesso, CRUD/histórico e integração backend |

Atribuições são sugestões iniciais para o planejamento; cada autor deve efetivamente produzir seus commits e explicar sua contribuição. PO e Scrum Master também assumem tarefas documentadas e verificáveis, sem commits artificiais em nome de outras pessoas.

## 3. Stack e arquitetura

- **Cliente:** React Native, Expo, TypeScript, Expo Router.
- **Serviço:** Supabase Auth, PostgreSQL, Realtime, Edge Functions e/ou RPC transacional PostgreSQL conforme a operação.
- **Persistência:** banco relacional com chaves primárias e estrangeiras; migrations SQL versionadas.
- **Sincronização:** servidor é fonte única da verdade; cliente envia somente intenções (`play_card`, `request_truco`, `respond_truco`, `fold`, etc.) e recebe projeções autorizadas do estado.
- **Segurança:** autenticação obrigatória; RLS; backend sorteia e distribui cartas; nenhuma mão alheia trafega para o cliente; validar servidor-side turno, posse da carta, regras, pontuação e versão da partida. Não expor `service_role`/segredos no app. Publicação Realtime não deve permitir acesso direto ao estado privado; eventos públicos e mãos privadas devem ter canais/projeções adequados, com autorização testada.
- **Conectividade:** requer internet; se cair, informar e tentar retomar estado persistido sem duplicar ação. O aplicativo não depende de um celular-host executar as regras ou permanecer ativo; “host” é o proprietário/administrador da sala.

## 4. Modos de visualização

### Quatro aparelhos, sem mesa exclusiva (caminho principal)

Cada celular mostra uma tela **dividida**: parte superior contém mesa pública (cartas já jogadas, vira/manilha, placar, turnos e estado do truco); parte inferior contém **somente a mão do usuário**, com cartas selecionáveis e a ação contextual primária. Informações e controles devem caber em telefones comuns e permanecer utilizáveis com tamanho de fonte ampliado.

### Mesa opcional (quinto aparelho)

Um aparelho adicional pode entrar em **modo mesa**, não ocupa vaga de jogador e exibe **somente estado público**. Os quatro celulares mantêm suas mãos privadas e controles. O layout pode priorizar a mão e controles nos celulares de jogadores, mas deve conservar acesso claro ao placar/estado mesmo que a mesa fique indisponível. O host também pode ser jogador; o quinto dispositivo é opcional.

## 5. Fluxos e telas

1. **Autenticação:** cadastrar conta, entrar, sair; validar e-mail via REGEX, senha e mensagens de erro; sessão persistente.
2. **Início:** “Criar sala”, “Entrar na sala”, “Histórico”.
3. **Lobby:** código curto compartilhável, quatro posições fixas, duplas/assentos alternados, proprietário da sala, pronto/iniciar. Impedir duplicidade de posição e iniciar com menos de quatro jogadores.
4. **Modo mesa opcional:** acesso restrito à projeção pública, sem participar como jogador e sem leitura de cartas privadas; confirmar com clareza como o dispositivo se associa à sala.
5. **Partida:** sortear/distribuir três cartas por jogador (baralho de 40), revelar vira, calcular manilha variável, identificar vez, jogar carta, resolver vaza e mão, processar pedidos de truco, atualizar placar.
6. **Fim:** vencedor da partida (12 pontos), confirmar registro e possibilitar nova partida.
7. **Histórico (CRUD):** criar registro de resultado em fluxo de partida e oferecer CRUD demonstrável sobre **anotações/etiquetas do histórico** (ou registros manuais claramente identificados), sem permitir alterar resultados oficiais de partidas encerradas. Exibir registros, editar anotação e excluir anotação/registro manual com confirmação. O CRUD de anotação permite CREATE/READ/UPDATE/DELETE verificáveis e relacionados a partida/usuário.

## 6. Regras do Truco Paulista

- Quatro jogadores (2 x 2), baralho de 40 cartas sem 8, 9, 10 e curingas; três cartas por jogador.
- Vira exposta; a manilha é o valor seguinte ao da vira na ordem paulista, com volta circular. Adotar ordem base de força **4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3**; manilhas superam cartas comuns; entre manilhas, desempatar pelos naipes na ordem convencionada **ouros < espadas < copas < paus**.
- Cada mão tem até três vazas; a primeira dupla a vencer duas vence a mão, respeitando regras explícitas de empates. A mão vale inicialmente 1 ponto; sequência de aposta 3, 6, 9, 12. Aceite, aumento e recusa devem seguir uma máquina de estados, sem saltos nem pedidos simultâneos, e registrar quem pode responder. Uma recusa dá à dupla solicitante a pontuação vigente **antes** do pedido recusado.
- A partida termina quando uma dupla atinge 12 pontos. Implementar tratamento formal da mão de 11 e dos empates, com decisões registradas em `docs/RULES.md` e testes automatizados antes da apresentação. **Convenções regionais precisam ser validadas pela PO**; não inventar regras enquanto houver ambiguidade.
- Servidor não deve aceitar jogar carta fora de turno, carta inexistente ou já jogada, ação duplicada, resposta de truco pela dupla indevida ou alteração direta de placar.

**Convenções provisórias a validar:** sequência de quem abre a próxima vaza em empate, empate na primeira/segunda/terceira vaza, mão de 11 quando ambas duplas têm 11, e política de desistência em cada estado. Se uma convenção impedir conclusão segura do prazo, explicitar a limitação na demonstração; nunca alegar cobertura total sem testes.

## 7. Modelo de dados proposto

- `profiles (id PK -> auth.users.id, display_name, created_at)`.
- `rooms (id PK, code UNIQUE, host_user_id FK -> profiles.id, status, created_at)`.
- `room_players (id PK, room_id FK, user_id FK, seat, team, ready, UNIQUE(room_id,user_id), UNIQUE(room_id,seat))`.
- `matches (id PK, room_id FK, state, score_a, score_b, current_turn_user_id FK, revision, started_at, ended_at, winner_team)`.
- `match_players (match_id FK, user_id FK, seat, team, PK(match_id,user_id))` para preservar composição da partida.
- `match_events (id PK, match_id FK, actor_user_id FK, action, payload_public, revision, created_at)`; sem campos sensíveis no payload público.
- `private_hands (match_id FK, user_id FK, cards, ...)` em schema/recurso privado não consultável por adversários; idealmente entregue somente por função autenticada que retorna a própria mão. Não incluir mãos completas em subscriptions de tabelas públicas.
- `match_notes (id PK, match_id FK, author_user_id FK, title, notes, created_at, updated_at)` para CRUD avaliado: notas pessoais vinculadas a partidas, com RLS por autor.

Adaptar colunas conforme necessidade; manter PK/FK, constraints, índices e migrations. `auth.users` não substitui modelagem pública e políticas RLS. Criar seed/testes sem inserir senhas reais no repositório.

## 8. Histórias e critérios essenciais (P0)

| ID | História | Aceite mínimo |
|---|---|---|
| US-01 | Como pessoa, cadastro-me e faço login | Erro claro para e-mail inválido (REGEX), senha inválida e credenciais incorretas; sessão funciona |
| US-02 | Como host, crio sala | Código único, compartilhabilidade, estado no banco |
| US-03 | Como jogador, entro por código | Quatro assentos; assento e dupla inequívocos; entrada inválida é rejeitada |
| US-04 | Como host, inicio a partida | Somente quatro jogadores prontos; backend distribui mãos exclusivas e vira |
| US-05 | Como jogador, vejo minhas cartas | Vejo exatamente minha mão e mesa pública; não consigo obter mão adversária |
| US-06 | Como jogador, jogo na minha vez | Servidor valida a carta; todos veem carta jogada e próximo turno |
| US-07 | Como jogador, peço/aceito/recuso/aumento truco | Apenas ações legais disponíveis; placar calculado por servidor |
| US-08 | Como jogador, acompanho a partida | Vazas, empates e mãos resolvidos; vitória em 12; reconexão sem corrupção |
| US-09 | Como usuário, vejo e gerencio minhas notas de histórico | Criar, consultar, editar, excluir e confirmar exclusão com DB persistente |
| US-10 | Como grupo, demonstro o trabalho | README, requisitos, testes, história de commits e Scrum rastreáveis |

**P1 (se P0 estiver estável):** quinto aparelho em modo mesa, QR code da sala, polimento visual adicional. **Nota:** ainda é requisito de produto que a mesa opcional seja suportada; P1 indica prioridade de entrega sob risco de prazo, não seu abandono permanente.

## 9. Qualidade e acessibilidade

- Interface clean sem ornamentos supérfluos; cartas com visual de baralho tradicional (figuras clássicas, não simples emojis), sem imagens de terceiros sem licença.
- Controles grandes (alvo de toque preferencial >= 44 × 44 pt), textos legíveis, alto contraste, distinção por forma/texto além de cor, estados claros de carregamento/erro/sucesso.
- Testar vertical em Android, Expo Go quando compatível, e ao menos quatro sessões/contas distintas em aparelhos ou emuladores; sem depender da própria interface para provar autorização backend.
- Não prometer operação offline, latência zero, biometria ou produção endurecida no MVP.

## 10. Verificação para apresentação SENAI

O enunciado exige login/autenticação, REGEX, navegação, UX/UI, banco com ao menos duas tabelas relacionadas (PK/FK), CRUD completo, mensagens de erro, Git/GitHub, organização Scrum, aplicativo funcional, README e documento ABNT separado.

**Roteiro de demonstração:** (1) login inválido e válido; (2) REGEX; (3) criar e entrar em sala; (4) quatro mãos privadas e vira pública; (5) carta jogada e sincronização; (6) pedido de truco e alteração automática do placar; (7) mostrar conclusão/histórico; (8) executar CREATE, READ, UPDATE, DELETE em `match_notes`; (9) apresentar duas tabelas relacionadas, RLS, testes, board e commits individuais. Se não der para concluir partida ao vivo, disponibilizar fixture ou demonstração controlada identificada explicitamente, sem fingir comportamento real.

**Entregáveis:** aplicativo funcional; repositório e README com objetivo, equipe, tecnologias e execução; SPEC.md; backlog/Scrum e evidências; documentação ABNT produzida separadamente pelo grupo; apresentação em que todos expliquem sua atuação.

## 11. Plano de 1 dia e critérios de corte

- **Etapa 1, contrato (início):** definição de schema/RPC, tipos compartilhados, regras escritas, telas e responsáveis.
- **Etapa 2, implementação paralela:** autenticação/UI; salas; motor; schema/CRUD. Branches pequenas e PRs/commits rastreáveis.
- **Etapa 3, integração:** fluxo ponta a ponta em quatro clientes e testes de privacidade/turnos/placar; correções.
- **Etapa 4, entrega:** README, evidências Scrum, roteiro, teste de demonstração e congelamento.

**Critério de corte:** priorizar primeiro login + sala + distribuição privada + uma mão funcional + placar/CRUD; depois ampliar para partida inteira e mesa opcional. Uma entrega parcial precisa declarar honestamente quais histórias não foram concluídas. O risco maior é sincronização transacional e segurança das mãos; testar isso antes de polir telas.

## 12. Dependências e riscos

O grupo precisa criar projeto Supabase, fornecer URL e chave **publishable/anon** via ambiente local seguro, configurar secrets das funções de servidor sem versioná-los, aplicar migrations e preparar quatro usuários de teste. Sem isso, o código não executará multiplayer real. Não embutir credenciais no repositório. Documentar configuração e plano de demonstração.
