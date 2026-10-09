import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { fetchServerNow } from './api';
import { clockOffset } from './deadline';

/** Abaixo disso a diferença nova não redesenha a tela: o relógio já está bom. */
const OFFSET_TOLERANCE_MS = 250;

/**
 * Diferença entre o relógio do servidor e o do aparelho. Lida ao montar e ao voltar do segundo plano
 * (o relógio do aparelho pode ter mudado); `observe` aproveita o `serverNow` das respostas de jogada.
 * Com ela, a contagem é a mesma em todos os aparelhos, e uma reconexão mostra o tempo que falta certo.
 */
export function useServerClock(fetchNow: () => Promise<number> = fetchServerNow) {
  const [offset, setOffset] = useState(0);

  const observe = useCallback((serverNow: number, sentAt: number, receivedAt: number) => {
    const next = clockOffset(sentAt, receivedAt, serverNow);
    setOffset((current) => (Math.abs(current - next) > OFFSET_TOLERANCE_MS ? next : current));
  }, []);

  const sync = useCallback(async () => {
    const sentAt = Date.now();
    try {
      observe(await fetchNow(), sentAt, Date.now());
    } catch {
      // Sem rede: mantém a última diferença conhecida. O servidor confere o prazo do mesmo jeito.
    }
  }, [fetchNow, observe]);

  useEffect(() => {
    sync();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') sync();
    });
    return () => subscription.remove();
  }, [sync]);

  return { offset, observe };
}
