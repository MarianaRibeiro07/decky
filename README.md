# Decky

Aplicativo mobile que substitui as cartas físicas em partidas **presenciais** de Truco Paulista. Quatro pessoas, em duas duplas, entram na mesma sala pela internet. Cada jogador vê somente as próprias cartas; todos acompanham a mesa, a vira, as manilhas, a vez, os pedidos de truco e o placar.

Projeto da atividade de Desenvolvimento Mobile/Scrum do SENAI. Apresentação prevista: **09/10/2026**.

> **Estado atual: planejamento.** Não existe código do aplicativo ainda. Tudo listado em "Funcionalidades do MVP" está **planejado, não implementado**. O status real de cada tarefa fica em [docs/SPRINT_BACKLOG.md](docs/SPRINT_BACKLOG.md).

## Funcionalidades do MVP (planejadas)

- Cadastro, login e logout com validação por REGEX e mensagens de erro claras.
- Criar sala com código curto, entrar por código, quatro posições fixas e duas duplas.
- Início de partida pelo dono da sala, com distribuição de cartas feita **no servidor**.
- Tela dividida: mesa pública em cima, mão privada embaixo.
- Truco Paulista completo: manilha variável, vazas, pedidos 3/6/9/12, placar automático até 12 pontos.
- Histórico com CRUD de notas ligadas às partidas.
- Opcional (P1): quinto aparelho em modo mesa, que só vê o estado público.

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
- Um projeto Supabase criado pelo grupo (URL e chave publishable/anon).

## Como executar

**A implementar.** Quando o app existir, estes passos serão preenchidos pelo grupo:

1. Instalar dependências.
2. Copiar `.env.example` para `.env` e preencher com os valores do projeto Supabase.
3. Aplicar as migrations de `supabase/migrations/`.
4. Iniciar o app com Expo.

### Variáveis de ambiente

Nomes previstos (valores **nunca** entram no Git; o arquivo `.env.example` será criado por Rafael com placeholders):

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

O documento ABNT é produzido pelo grupo separadamente e não faz parte deste repositório de planejamento.
