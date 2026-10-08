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

## Pendente de decisão da PO

O SPEC marca estas convenções como **provisórias a validar**. Até a PO decidir, a coluna "Decisão" fica vazia e o motor **não** assume nada.

| ID | Pergunta | Decisão | Data |
|---|---|---|---|
| D-01 | Quem abre a vaza seguinte quando a vaza anterior empata? | (pendente) | |
| D-02 | Empate na 1ª vaza: quem vence a mão pela vaza seguinte? | (pendente) | |
| D-03 | Empate na 2ª vaza depois de a 1ª ter vencedor | (pendente) | |
| D-04 | Empate na 3ª vaza | (pendente) | |
| D-05 | Mão de 11: a dupla com 11 vê as cartas do parceiro? Pode pedir truco? | (pendente) | |
| D-06 | Mão de 11 quando as duas duplas têm 11 | (pendente) | |
| D-07 | Desistência (fold) em cada estado, inclusive depois de truco aceito | (pendente) | |
| D-08 | Aumento de aposta depois de aceite: quem pode aumentar e quando (ex.: após aceitar 3, quem pode pedir 6) | (pendente) | |

Cada decisão deve ser escrita como regra operacional curta (exemplo: "Em empate na 1ª vaza, vence a mão quem vencer a 2ª") e acompanhada do teste correspondente.

## Testes planejados

Nenhum teste foi escrito nem executado. Lista do que Eduardo deve cobrir:

- Baralho tem 40 cartas únicas; distribuição de 12 cartas sem repetição e vira distinta.
- Manilha para cada vira possível, incluindo a volta (vira 3 gera manilha 4).
- Força: toda manilha vence toda comum; ordem de naipes entre manilhas.
- Vaza: carta mais forte vence; empate de força comum.
- Mão: 2 vazas vencem; 1 a 1 e terceira vaza decide; empates conforme D-01 a D-04.
- Truco: 1 para 3, 3 para 6, 6 para 9, 9 para 12; recusa em cada nível; pedido simultâneo rejeitado; resposta da dupla errada rejeitada.
- Placar: soma correta, 12 encerra, não passa de 12 por aceite.
- Mão de 11 e desistência conforme D-05 a D-07.
- Validação: fora de turno, carta que não é do jogador, carta repetida, ação duplicada (mesmo `clientActionId`).

## Limitações a declarar na demonstração

Qualquer regra de D-01 a D-08 que não esteja decidida **e testada** até a apresentação deve ser apresentada como limitação, nunca como cobertura total.
