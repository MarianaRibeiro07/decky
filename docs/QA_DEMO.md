# QA e Demonstração

Nenhum item abaixo foi executado ainda. Marque `[x]` somente com evidência (foto, log, captura) anotada ao lado. Responsável pela execução: Mariana (aceite) com apoio de Isabela (registro).

## Pré-condições da demonstração

- [ ] Projeto Supabase criado, migrations aplicadas (Rafael).
- [ ] 4 usuários de teste criados, senhas fora do Git.
- [ ] 4 aparelhos ou emuladores com o app e internet.
- [ ] Dispositivo reserva com a fixture de partida (ver "Plano B").

## Requisitos da avaliação SENAI

| # | Requisito | Como provar | OK |
|---|---|---|---|
| 1 | Login/autenticação | Login válido entra; inválido mostra erro | [ ] |
| 2 | REGEX | E-mail inválido barrado antes de enviar; mostrar a expressão no código | [ ] |
| 3 | Navegação | Home, sala, jogo, histórico, voltar e sair | [ ] |
| 4 | UX/UI | Botões grandes, contraste, pouco texto, fonte ampliada ainda usável | [ ] |
| 5 | Banco com 2+ tabelas relacionadas | Mostrar `rooms` e `room_players` (PK/FK) no painel | [ ] |
| 6 | CRUD completo | CREATE, READ, UPDATE, DELETE em `match_notes` | [ ] |
| 7 | Mensagens de erro | Erros de login, sala cheia, código inválido, jogada ilegal | [ ] |
| 8 | Git/GitHub | Histórico com commits de cada integrante dev | [ ] |
| 9 | Scrum | Backlog, Daily, Review, Retrospective registrados em [SCRUM.md](SCRUM.md) | [ ] |
| 10 | README | Objetivo, equipe, tecnologias e execução batendo com a realidade | [ ] |
| 11 | Documento ABNT | Entregue pelo grupo, fora deste repositório | [ ] |

## Testes de aceitação por história

Cada história tem seus critérios em [PRODUCT_BACKLOG.md](PRODUCT_BACKLOG.md). Aqui ficam os testes técnicos transversais.

### Segurança das cartas

- [ ] Com o token do jogador A, `select` em `private.private_hands` falha ou retorna 0 linhas.
- [ ] Com o token de A, `get_my_hand(match_id)` retorna só a mão de A.
- [ ] Com o token de alguém que não está na partida, `get_my_hand` retorna vazio ou erro.
- [ ] Inspecionar o tráfego Realtime dos 4 aparelhos: nenhum payload contém cartas de outro jogador.
- [ ] `payload_public` de `match_events` não contém mão.
- [ ] Chave `service_role` não aparece no código, no bundle nem em `git log -p`.

### Turnos e concorrência

- [ ] Jogar fora da vez é rejeitado pelo servidor (chamada direta, sem a UI).
- [ ] Jogar carta que não é sua e carta já jogada são rejeitados.
- [ ] Duas ações na mesma `revision` ao mesmo tempo: uma passa, a outra recebe conflito.
- [ ] Reenviar o mesmo `clientActionId` não duplica a jogada.
- [ ] Dois usuários pegando a mesma posição: só um entra.
- [ ] `start_match` chamado duas vezes cria uma única partida.

### Truco e placar

- [ ] Pedido, aceite, recusa e aumento seguem a máquina de estados; botões ilegais não aparecem.
- [ ] Dupla errada tentando responder é rejeitada.
- [ ] Recusa pontua com o valor anterior ao pedido.
- [ ] O cliente não consegue enviar placar (tentativa direta é negada).

### Fluxo da partida

- [ ] Virada de vaza: depois da 4ª carta, a vaza resolve e abre a próxima.
- [ ] Fim de mão: placar soma e nova mão é distribuída.
- [ ] Vitória em 12: partida encerra, mostra vencedora e grava `ended_at`.
- [ ] Reconexão: matar e reabrir o app de um jogador restaura mão e estado, sem ação duplicada.

### Notas (CRUD) e RLS

- [ ] CREATE, READ, UPDATE, DELETE com confirmação na exclusão.
- [ ] Usuário B não vê, edita nem apaga nota de A.
- [ ] Editar nota não altera resultado da partida.

### Modo mesa (5 aparelhos)

- [ ] "Criar sala" > "Este celular será a mesa": o dono não ocupa lugar e os 4 lugares ficam livres.
- [ ] Os 4 jogadores entram e marcam pronto; a mesa inicia a partida.
- [ ] A mesa mostra placar das duplas com nomes, vez, vira, manilha, cartas jogadas e versos restantes, e nenhuma carta de mão.
- [ ] Com o token da mesa, `get_my_hand` devolve vazio e `submit-action` devolve `not_member`.
- [ ] Fechar o app da mesa não interrompe a partida nos 4 celulares; reabrir mostra o estado atual.
- [ ] No lobby, o dono troca entre "quero jogar" e "este celular será a mesa".

### Mesa e distribuição animada

- [ ] Ao iniciar, as cartas saem do baralho para os 4 lugares; cada jogador vê as 3 cartas chegando; a vira é revelada e a manilha indicada.
- [ ] A partir da 2ª mão, a última vaza aparece por um instante antes da nova distribuição.
- [ ] Reabrir o app no meio da mão não repete a distribuição.
- [ ] Tocar numa carta a seleciona; "Jogar" confirma; a carta sai da mão e aparece na posição de quem jogou nos outros aparelhos.
- [ ] Toque duplo rápido em "Jogar" envia uma jogada só.
- [ ] Pedido de truco: a dupla adversária vê Aceitar, Correr e Pedir SEIS; o parceiro de quem pediu só aguarda; a mesa mostra o pedido.

## Roteiro de demonstração (4 dispositivos)

Tempo-alvo e falas por pessoa ficam com a Mariana (T-MAR-04). Sequência:

1. Login inválido, depois válido; mostrar a REGEX. (Nicoly)
2. Criar sala e mostrar o código; três aparelhos entram. (Caio)
3. Iniciar partida; mostrar a distribuição animada, que cada aparelho vê 3 cartas diferentes e a vira pública. Se houver um quinto celular, criar a sala no modo mesa e deixá-lo no centro. (Caio e Rafael)
4. Jogar uma carta e ver a sincronização nos 4 aparelhos. (Eduardo)
5. Pedir truco, responder, e ver o placar mudar sozinho. (Eduardo)
6. Mostrar o fim de mão, ou o fim de partida se couber. (Eduardo)
7. Histórico: CREATE, READ, UPDATE, DELETE de uma nota. (Rafael e Nicoly)
8. No painel do banco: tabelas com PK/FK, RLS, e um teste de leitura cruzada negada. (Rafael)
9. Mostrar board de issues, commits e SCRUM.md. (Isabela)
10. Fechamento e limitações declaradas. (Mariana)

## Plano B se algo quebrar

Regra: **nunca fingir funcionalidade**. Se um trecho falhar:

- Avisar a plateia que aquele trecho é uma demonstração controlada.
- Usar a fixture: uma partida pré-criada no banco, em estado já avançado, identificada com título "FIXTURE" na tela e na fala.
- Para mostrar só a interface (sem servidor), a rota `/dev/preview` do build de desenvolvimento simula uma partida no próprio aparelho, com a barra "FIXTURE LOCAL · sem servidor" visível. Dizer em voz alta que é simulação.
- Se o motor falhar ao vivo, mostrar a suíte de testes unitários rodando e os casos cobertos.
- Mostrar a limitação correspondente de [RULES.md](RULES.md) quando a falha vier de regra não decidida.
