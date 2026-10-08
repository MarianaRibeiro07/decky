# Regras do Truco Paulista no Decky

Dono das decisões: **Mariana Ribeiro (PO)**. Implementação: Eduardo Zanetti. Fonte: [SPEC.md](../SPEC.md), seção 6.

Este arquivo separa o que está **confirmado no SPEC** do que está **pendente**. Eduardo só escreve teste para o que está confirmado ou decidido; pendência não vira código por suposição.

## Confirmado

| Item | Regra |
|---|---|
| Jogadores | 4, em 2 duplas; posições alternadas (1 e 3 contra 2 e 4) |
| Baralho | 40 cartas: sem 8, 9, 10 e curingas |
| Mão | 3 cartas por jogador |
| Vira | Uma carta exposta por mão |
| Força das cartas comuns | 4 < 5 < 6 < 7 < Q < J < K < A < 2 < 3 |
| Manilha | O valor seguinte ao da vira na ordem acima, com volta circular (vira 3, manilha 4) |
| Manilha x comum | Manilha vence qualquer carta comum |
| Ordem dos naipes entre manilhas | ouros < espadas < copas < paus |
| Vazas | Até 3 por mão; a dupla que vencer 2 vence a mão |
| Valor da mão | Começa em 1; sequência de aposta 3, 6, 9, 12 |
| Recusa de truco | A dupla que pediu ganha os pontos vigentes **antes** do pedido recusado |
| Fim da partida | Dupla que atinge 12 pontos |
| Truco | Máquina de estados: sem saltos, sem pedidos simultâneos, resposta só da dupla adversária |
| Servidor rejeita | Jogada fora de turno, carta inexistente ou já jogada, ação duplicada, resposta da dupla errada, alteração direta de placar |

Observação para o código: "manilha supera comum" e "ordem dos naipes" valem como regra única; o motor deve ter um só ponto que calcula a força de uma carta dada a vira.

## Convenções adotadas (aguardando aceite da PO)

O SPEC marca estas convenções como **provisórias a validar**. Para o motor poder ser implementado e testado no prazo, o grupo adotou as convenções mais comuns do Truco Paulista abaixo. **A PO precisa aceitar ou mudar cada linha**; mudar uma regra é alterar o motor e o teste citado.

| ID | Pergunta | Convenção adotada | Onde no código | Teste |
|---|---|---|---|---|
| D-01 | Quem abre a vaza seguinte quando a vaza anterior empata? | Quem jogou primeiro a carta mais forte da vaza empatada | `strength.ts`, `resolveTrick` | `cards.test.ts`, "cartas iguais de duplas diferentes empatam" |
| D-02 | Empate na 1ª vaza | Vence a mão quem ganhar a 2ª; se a 2ª também empatar, quem ganhar a 3ª; três empates: ninguém pontua | `hand.ts`, `handOutcome` | `game.test.ts`, "resultado da mão" |
| D-03 | Empate na 2ª vaza depois de a 1ª ter vencedor | Vence quem ganhou a 1ª | `hand.ts` | idem |
| D-04 | Empate na 3ª vaza | Vence quem ganhou a 1ª vaza decidida | `hand.ts` | idem |
| D-05 | Mão de 11 | A mão vale 3 e ninguém pede truco. Se a dupla com 11 correr, a outra ganha 1 ponto. **Limitação:** a dupla com 11 não vê as cartas do parceiro | `game.ts`, `startHand` e `fold` | `game.test.ts`, "correr e mão de 11" |
| D-06 | Mão de 11 quando as duas duplas têm 11 (mão de ferro) | Vale 1, sem truco | `game.ts`, `startHand` | idem |
| D-07 | Desistência (correr) | Qualquer jogador pode correr quando não há pedido de truco pendente; a outra dupla ganha o valor atual da mão. Com truco pendente, correr é recusar | `game.ts`, `fold` e `refuse` | `game.test.ts`, "correr dá ao adversário o valor da mão" |
| D-08 | Aumento depois de aceite | Só a dupla que aceitou pode pedir o próximo valor. Quem responde também pode aumentar direto ("seis!"), o que aceita o pedido atual | `game.ts`, `raiseRight` e `raise` | `game.test.ts`, "aceite muda o valor..." e "sobe 3, 6, 9, 12" |

Outras escolhas do motor:

- Pedir truco só na própria vez. Responder pode qualquer jogador da dupla adversária, fora da vez.
- Enquanto há pedido pendente, ninguém joga carta.
- A primeira mão é aberta pelo assento 1; quem embaralha gira a cada mão.
- Carta igual (mesmo valor, sem ser manilha) da mesma dupla não empata: a dupla vence a vaza.

## Testes

Implementados em `tests/engine/` (Vitest, `npm test`). Todos os itens abaixo têm caso de teste, além de 200 partidas aleatórias jogadas até o fim conferindo que nenhuma carta some ou duplica e que o placar termina em 12:

- Baralho tem 40 cartas únicas; distribuição de 12 cartas sem repetição e vira distinta.
- Manilha para cada vira possível, incluindo a volta (vira 3 gera manilha 4).
- Força: toda manilha vence toda comum; ordem de naipes entre manilhas.
- Vaza: carta mais forte vence; empate de força comum.
- Mão: 2 vazas vencem; 1 a 1 e terceira vaza decide; empates conforme D-01 a D-04.
- Truco: 1 para 3, 3 para 6, 6 para 9, 9 para 12; recusa em cada nível; pedido simultâneo rejeitado; resposta da dupla errada rejeitada.
- Placar: soma correta, 12 encerra, não passa de 12 por aceite.
- Mão de 11 e desistência conforme D-05 a D-07.
- Validação: fora de turno, carta que não é do jogador, carta repetida. A ação duplicada (mesmo `clientActionId`) é barrada no banco e testada em `tests/sql/matches.test.ts`.

## Limitações a declarar na demonstração

Qualquer regra de D-01 a D-08 que não esteja decidida **e testada** até a apresentação deve ser apresentada como limitação, nunca como cobertura total.

Já se sabe que fica de fora: na mão de 11, a dupla com 11 não vê as cartas do parceiro antes de decidir.
