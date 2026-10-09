# Decky

Aplicativo mobile que substitui as cartas físicas em partidas **presenciais** de Truco Paulista. Quatro pessoas, em duas duplas, entram na mesma sala pela internet. Cada jogador vê somente as próprias cartas; todos acompanham a mesa, a vira, as manilhas, a vez, os pedidos de truco e o placar. Opcionalmente, um quinto celular fica no centro como mesa.

Projeto da atividade de Desenvolvimento Mobile/Scrum do SENAI. Apresentação prevista: **09/10/2026**.

> **Estado atual: implementado, aguardando teste em 4 e 5 aparelhos.** O app, o backend (migrations, RLS, RPCs, Edge Functions) e o motor de regras existem e passam nos testes automatizados, inclusive uma partida inteira até 12 pontos rodando o código das Edge Functions contra as migrations reais. Ainda não foram verificados no Supabase real com celulares. O status de cada tarefa fica em [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md).

## Funcionalidades do MVP

- Cadastro, login e logout com validação por REGEX e mensagens de erro claras.
- Criar sala com código curto escolhendo o modo: **o dono joga** (4 celulares) ou **o celular do dono vira a mesa** (5 celulares). Dá para trocar no lobby.
- Entrar por código, quatro posições fixas e duas duplas.
- Início de partida pelo dono da sala, com distribuição de cartas feita **no servidor**.
- Tela do jogador dividida: mesa pública em cima, mão privada embaixo, com seleção e confirmação da carta e controles de truco contextuais.
- Mesa central (modo mesa): só informações públicas, em tela cheia, sem mão e sem poder jogar (garantido pelo servidor). Nesse modo os 4 celulares dos jogadores mostram só a própria mão, os controles e o essencial público; a mesa completa fica no aparelho da mesa.
- Distribuição animada: as cartas saem do baralho até cada jogador, a vira é revelada e a manilha indicada; anima uma vez por mão e não se repete ao reconectar.
- Truco Paulista completo: manilha variável, vazas, pedidos 3/6/9/12, placar automático até 12 pontos.
- Histórico com CRUD de notas ligadas às partidas.
- **Não implementado (P1):** QR code da sala.

## Equipe

| Pessoa | Papel | Foco |
|---|---|---|
| Mariana Ribeiro | Product Owner | Escopo, regras, critérios de aceite, apresentação |
| Isabela Puzenato | Scrum Master | Backlog, issues, Daily, impedimentos, evidências |
| Nicoly Ribeiro | Dev | Design system, telas, navegação, cadastro e login |
| Caio Yuri | Dev | Salas, posições, duplas, presença e sincronização |
| Eduardo Zanetti | Dev | Motor de regras do Truco Paulista e testes |
| Rafael Brecci | Dev | Supabase, schema, RLS, RPC, histórico e CRUD |

## Stack

React Native, Expo, TypeScript e Expo Router no cliente. Supabase (Auth, PostgreSQL, Realtime, Edge Functions e/ou RPC) no servidor. O servidor é a fonte única da verdade; o cliente só envia intenções de jogada.

## Pré-requisitos

- Node.js LTS e npm.
- Aplicativo Expo Go em um celular ou um emulador Android.
- O projeto Supabase do grupo, com as migrations e as Edge Functions publicadas (ver "Backend").

## Como executar

1. `npm install`
2. Copiar `.env.example` para `.env` e preencher com a URL e a chave anon do projeto Supabase (sem `/rest/v1/` no fim da URL).
3. `npx expo start` e ler o QR code com o Expo Go.

### Backend

O Supabase está ligado ao repositório `rbrecci/Decky` pela integração GitHub. Quando `supabase/` chega na branch de produção de lá, as migrations são aplicadas e as Edge Functions de `supabase/config.toml` são publicadas. Detalhes e plano B em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#deploy).

A versão com modo mesa precisa da migration `20261008180000_table_mode.sql` e da **republicação das duas Edge Functions**.

Para a demonstração, desligue **Confirm email** em Authentication > Providers > Email no painel do Supabase.

### Testes

`npm test` roda tudo (Vitest):

| Pasta | O que cobre |
|---|---|
| `tests/engine/` | Motor do truco: baralho, manilha, vazas, empates, truco 3/6/9/12, correr, mão de 11, 200 partidas aleatórias |
| `tests/sql/` | Migrations reais num Postgres em memória (PGlite): salas, modo mesa, RLS, mãos privadas, idempotência, conflito de revisão, CRUD de notas e, em `flow.test.ts`, o código das Edge Functions jogando com 5 aparelhos (incluindo uma partida inteira até 12) |
| `tests/app/` | REGEX de e-mail, senha e nome; textos da mesa; geometria sem sobreposição; distribuição (ordem, fases calculadas no render, chegada das cartas, uma vez por mão); controles de truco; papel do aparelho e tela do jogador com mesa dedicada; leituras repetidas sem re-render; canais Realtime únicos |

`npm run typecheck` confere os tipos do app e do motor. O projeto não tem lint configurado.

### Fixture visual (só desenvolvimento)

Com `npx expo start`, a rota `/dev/preview` mostra a mesa com uma partida **simulada no próprio aparelho** pelo motor de regras (barra "FIXTURE LOCAL · sem servidor"), com botões para ver como cada lugar ou como a mesa. Alterna entre "com mesa" (5 aparelhos) e "sem mesa" (4 aparelhos). Serve para revisar layout e animação sem Supabase e sem 4 celulares. **Não é o multiplayer real** e não deve ser apresentada como tal. Em build de produção a rota só mostra "Indisponível".

### Variáveis de ambiente

Valores **nunca** entram no Git; o `.env` é ignorado pelo `.gitignore`:

| Variável | Uso |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Chave publishable/anon, a única que o app pode conter |

A chave `service_role` e quaisquer secrets de função ficam apenas no painel do Supabase, nunca no app nem no repositório.

## Documentação

| Documento | Conteúdo |
|---|---|
| [SPEC.md](SPEC.md) | Especificação do MVP |
| [docs/PRODUCT_BACKLOG.md](docs/PRODUCT_BACKLOG.md) | Histórias US-01 a US-10 com critérios de aceite |
| [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md) | Tarefas por pessoa, dependências e verificação |
| [docs/SCRUM.md](docs/SCRUM.md) | Sprint de 1 dia, cerimônias e registros |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Arquitetura, contratos, dados e segurança |
| [docs/RULES.md](docs/RULES.md) | Regras do Truco Paulista e pendências para a PO |
| [docs/QA_DEMO.md](docs/QA_DEMO.md) | Checklist de QA e roteiro de demonstração |
| [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) | Branches, commits, PRs e segredos |

O documento ABNT é produzido pelo grupo separadamente e não faz parte deste repositório.
