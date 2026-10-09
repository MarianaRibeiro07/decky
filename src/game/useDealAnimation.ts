import { useMemo } from 'react';
import type { PublicGameState } from '../contracts/types';
import { useRerenderAt } from '../lib/useRerenderAt';
import { dealKey, dealPhaseChanges, dealPhaseNow, dealTracker, type DealPhase, type DealRun } from './deal';

export interface DealAnimation {
  phase: DealPhase;
  /** Execução desta mão (para os voos retomarem do ponto certo); null quando a mão não anima. */
  run: DealRun | null;
}

const NO_MOMENTS: number[] = [];

/**
 * Fase visual da distribuição da mão atual. Começa quando chega um `handNumber` novo
 * ainda sem cartas jogadas e termina por tempo. Nenhuma regra depende disso: as cartas
 * já estão gravadas no servidor e a mão pode ser jogada mesmo que a animação não rode.
 *
 * A fase sai do relógio no próprio render (não de um efeito), então a mão nova nunca
 * aparece aberta por um quadro antes de a animação começar.
 */
export function useDealAnimation(matchId: string | undefined, state: PublicGameState | undefined): DealAnimation {
  const handNumber = state?.handNumber;

  // O tracker guarda a primeira decisão de cada mão: registrar no render é idempotente
  // (render repetido, Realtime duplicado ou remontagem devolvem a mesma execução).
  const run = useMemo(
    () => (matchId && state && handNumber !== undefined ? dealTracker.start(dealKey(matchId, handNumber), state, Date.now()) : null),
    // Só a troca de mão decide a animação; outras mudanças de estado não a reiniciam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchId, handNumber],
  );

  useRerenderAt(run ? dealPhaseChanges(run) : NO_MOMENTS);
  const phase = dealPhaseNow(run, Date.now());

  return useMemo(() => ({ phase, run }), [phase, run]);
}
