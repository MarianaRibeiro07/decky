# Scrum

Documento de processo. Tudo que está em "Registros" começa **vazio de propósito**: só se preenche o que realmente aconteceu, por quem esteve presente.

## Meta da Sprint

Sprint única de 1 dia, com a apresentação em **09/10/2026**.

> Quatro pessoas conseguem entrar em uma sala, receber cartas privadas, jogar uma mão com placar calculado pelo servidor e gerenciar notas do histórico, tudo a partir de contas autenticadas.

O que não cabe nesta meta fica fora ou em P1 (ver "Custo e corte" em [SPRINT_BACKLOG.md](SPRINT_BACKLOG.md)).

## Papéis

| Papel | Pessoa |
|---|---|
| Product Owner | Mariana Ribeiro |
| Scrum Master | Isabela Puzenato |
| Time de desenvolvimento | Nicoly Ribeiro, Caio Yuri, Eduardo Zanetti, Rafael Brecci |

## Microcheckpoints do dia

Horários são **sugestão**, a Isabela ajusta ao dia real do grupo.

| # | Checkpoint | Duração | Saída esperada |
|---|---|---|---|
| 1 | Alinhamento | 30 a 45 min | Contratos fechados (T-00), regras pendentes decididas pela PO, issues criadas |
| 2 | Implementação em paralelo | maior bloco do dia | Quatro frentes avançando em branches separadas, com PRs curtos |
| 3 | Integração | 1 a 2 h | Fluxo ponta a ponta em 4 clientes; primeiros testes de privacidade e turno |
| 4 | Validação | 1 h | Checklist de [QA_DEMO.md](QA_DEMO.md) executado pela PO; decisão de corte |
| 5 | Apresentação | até o fim | Congelamento do código, ensaio do roteiro, Review e Retrospective |

Regra de congelamento: depois do checkpoint 4, só entram correções de bug aprovadas pela PO.

## Daily

Curta (até 10 minutos por rodada) e feita em pé, quantas vezes a Isabela julgar útil no dia. Formato:

1. O que fiz desde a última Daily (com link de commit ou PR).
2. O que farei até a próxima.
3. Impedimentos.

## Impedimentos

Quem trava avisa a Isabela imediatamente, sem esperar a Daily. A Isabela registra, define dono e prazo, e escala para a PO se o corte de escopo for a saída.

## Sprint Review

Mariana confere cada história P0 contra seus critérios em [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md) e aceita ou rejeita. Rejeitada volta como pendência declarada na apresentação, nunca como "feita".

## Retrospective

Três perguntas: o que funcionou, o que travou, o que mudaremos na próxima Sprint.

---

## Registros

### Dailies realizadas

| Data e hora | Presentes | Resumo | Impedimentos |
|---|---|---|---|
| (vazio) | | | |

### Impedimentos e riscos

| ID | Data | Descrição | Dono | Estado | Resolução |
|---|---|---|---|---|---|
| R-01 | 08/10/2026 | Projeto Supabase e 4 usuários de teste ainda não existem; sem eles não há multiplayer real | Rafael | Aberto | |
| R-02 | 08/10/2026 | Convenções do Truco Paulista pendentes (ver [RULES.md](RULES.md)) | Mariana | Aberto | |
| R-03 | 08/10/2026 | Partida completa automática em 1 dia é o maior risco de prazo | Isabela | Aberto | Plano de corte em SPRINT_BACKLOG.md |
| R-04 | 08/10/2026 | Issues no GitHub ainda não criadas; as tarefas existem só em Markdown | Isabela | Aberto | |

### Evidências de contribuição

Uma linha por entrega concreta: commit, PR, issue, ata ou documento. PO e SM registram aqui o que entregaram.

| Pessoa | Data | Entrega | Evidência (link ou hash) |
|---|---|---|---|
| Rafael Brecci | 08/10/2026 | Documentação inicial de planejamento | commit inicial do repositório |

### Sprint Review realizada

(vazio, preencher no dia)

### Retrospective realizada

(vazio, preencher no dia)
