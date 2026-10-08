# Decky

Aplicativo mobile que substitui as cartas físicas em partidas **presenciais** de Truco Paulista. Quatro pessoas, em duas duplas, entram na mesma sala pela internet. Cada jogador vê somente as próprias cartas; todos acompanham a mesa, a vira, as manilhas, a vez, os pedidos de truco e o placar.

Projeto da atividade de Desenvolvimento Mobile/Scrum do SENAI. Apresentação prevista: **09/10/2026**.

> **Estado atual: implementado, aguardando teste em 4 aparelhos.** O app, o backend (migrations, RLS, RPCs, Edge Functions) e o motor de regras existem e passam nos testes automatizados. Ainda não foram verificados no Supabase real com 4 celulares. O status de cada tarefa fica em [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md).

## Funcionalidades do MVP

- Cadastro, login e logout com validação por REGEX e mensagens de erro claras.
- Criar sala com código curto, entrar por código, quatro posições fixas e duas duplas.
- Início de partida pelo dono da sala, com distribuição de cartas feita **no servidor**.
- Tela dividida: mesa pública em cima, mão privada embaixo.
- Truco Paulista completo: manilha variável, vazas, pedidos 3/6/9/12, placar automático até 12 pontos.
- Histórico com CRUD de notas ligadas às partidas.
- **Não implementado (P1):** quinto aparelho em modo mesa e QR code da sala.

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

Para a demonstração, desligue **Confirm email** em Authentication > Providers > Email no painel do Supabase.

### Testes

`npm test` roda tudo (Vitest):

| Pasta | O que cobre |
|---|---|
| `tests/engine/` | Motor do truco: baralho, manilha, vazas, empates, truco 3/6/9/12, correr, mão de 11, 200 partidas aleatórias |
| `tests/sql/` | Migrations reais num Postgres em memória (PGlite): salas, RLS, mãos privadas, idempotência, conflito de revisão, CRUD de notas |
| `tests/app/` | REGEX de e-mail, senha e nome; textos da mesa |

`npm run typecheck` confere os tipos do app e do motor.

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
