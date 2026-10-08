import type { Team, TrickResult } from './types.ts';

/**
 * Decide o vencedor da mão a partir das vazas já resolvidas.
 * Retorna a dupla vencedora, 'none' (três empates, ninguém pontua)
 * ou null quando a mão ainda não terminou.
 *
 * Convenções (RULES.md, D-02 a D-04):
 * - Quem vence 2 vazas vence a mão.
 * - Empate na 1ª: vence quem ganhar a 2ª (ou a 3ª, se a 2ª também empatar).
 * - Empate na 2ª ou na 3ª depois de uma vaza com vencedor: vence quem ganhou a 1ª vaza decidida.
 */
export function handOutcome(results: readonly TrickResult[]): Team | 'none' | null {
  const winsA = results.filter((r) => r === 'A').length;
  const winsB = results.filter((r) => r === 'B').length;
  if (winsA >= 2) return 'A';
  if (winsB >= 2) return 'B';

  const firstDecided = results.find((r): r is Team => r !== 'tie');

  if (results.length === 2) {
    const [first, second] = results;
    if (first === 'tie' && second !== 'tie') return second;
    if (first !== 'tie' && second === 'tie') return first;
    return null;
  }

  if (results.length === 3) {
    const third = results[2];
    if (third !== 'tie') return third;
    return firstDecided ?? 'none';
  }

  return null;
}
