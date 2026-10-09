import { useEffect, useState } from 'react';

/**
 * Redesenha o componente em cada instante (Date.now) da lista que ainda não passou.
 * Para estados que dependem só do relógio (fases da distribuição): o valor é calculado no render,
 * e isto apenas garante um render quando ele muda. Os timers são limpos ao desmontar.
 */
export function useRerenderAt(moments: readonly number[]): void {
  const [, setTick] = useState(0);
  const key = moments.join(',');

  useEffect(() => {
    const now = Date.now();
    const timers = moments
      .filter((at) => at > now)
      .map((at) => setTimeout(() => setTick((n) => n + 1), at - now));
    return () => timers.forEach(clearTimeout);
    // `key` representa a lista: um array novo com os mesmos instantes não reagenda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
