import { useEffect, useState } from 'react';
import type { PublicGameState } from '../contracts/types';
import { dealBoundaries, dealKey, dealPhaseAt, dealTracker, type DealPhase, type DealRun } from './deal';

export interface DealAnimation {
  phase: DealPhase;
  /** Execução em andamento (para os voos retomarem do ponto certo); null quando não há animação. */
  run: DealRun | null;
}

/**
 * Fase visual da distribuição da mão atual. Começa quando chega um `handNumber` novo
 * ainda sem cartas jogadas e termina por tempo. Nenhuma regra depende disso: as cartas
 * já estão gravadas no servidor e a mão pode ser jogada mesmo que a animação não rode.
 */
export function useDealAnimation(matchId: string | undefined, state: PublicGameState | undefined): DealAnimation {
  const [anim, setAnim] = useState<DealAnimation>({ phase: 'done', run: null });
  const handNumber = state?.handNumber;

  useEffect(() => {
    if (!matchId || !state || handNumber === undefined) return;
    const run = dealTracker.start(dealKey(matchId, handNumber), state, Date.now());
    if (!run) {
      setAnim({ phase: 'done', run: null });
      return;
    }

    const elapsed = Date.now() - run.startedAt;
    const b = dealBoundaries(run.intro);
    setAnim({ phase: dealPhaseAt(elapsed, run.intro), run });
    const timers = [b.dealing, b.reveal, b.done]
      .filter((at) => at > elapsed)
      .map((at) => setTimeout(() => setAnim({ phase: dealPhaseAt(at, run.intro), run }), at - elapsed));
    return () => timers.forEach(clearTimeout);
    // Só a troca de mão dispara a animação; outras mudanças de estado não a reiniciam.
  }, [matchId, handNumber]);

  return anim;
}
