import { describe, expect, it } from 'vitest';
import { cardsLeft, describeHand, describeTrick, tablePositions, trucoName } from '../../src/game/describe';

describe('textos da mesa', () => {
  it('nomeia os pedidos', () => {
    expect([3, 6, 9, 12].map(trucoName)).toEqual(['TRUCO', 'SEIS', 'NOVE', 'DOZE']);
  });

  it('fala da vaza do ponto de vista de quem olha', () => {
    expect(describeTrick('A', 'A')).toBe('Vaza nossa');
    expect(describeTrick('A', 'B')).toBe('Vaza deles');
    expect(describeTrick('tie', 'B')).toBe('Vaza empatada');
  });

  it('resume a mão', () => {
    expect(describeHand({ winner: 'A', points: 1, reason: 'tricks' }, 'A')).toBe('Ganhamos a mão (+1 ponto)');
    expect(describeHand({ winner: 'A', points: 3, reason: 'refused' }, 'B')).toBe('Corremos do truco (+3 pontos para eles)');
    expect(describeHand({ winner: 'B', points: 1, reason: 'fold' }, 'B')).toBe('Eles correram (+1 ponto para nós)');
    expect(describeHand({ winner: null, points: 0, reason: 'all_tied' }, 'A')).toBe('Mão empatada: ninguém pontua');
  });
});

describe('posições na mesa', () => {
  it('deixa o jogador embaixo, o parceiro em cima e a vez seguindo pela direita', () => {
    expect(tablePositions(1)).toEqual({ bottom: 1, right: 2, top: 3, left: 4 });
    expect(tablePositions(4)).toEqual({ bottom: 4, right: 1, top: 2, left: 3 });
  });

  it('conta as cartas na mão de cada assento', () => {
    expect(cardsLeft(2, 0, [], false)).toBe(3);
    expect(cardsLeft(2, 1, [1, 2], false)).toBe(1);
    expect(cardsLeft(3, 1, [1, 2], false)).toBe(2);
    expect(cardsLeft(3, 1, [], true)).toBe(0);
  });
});
