import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { channelTopic } from './channelTopic';
import { supabase } from './supabase';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

/**
 * Por que a leitura acontece. `changed`: o Realtime avisou que algo mudou (vale a pena buscar tudo de
 * uma vez); false no polling, na volta do segundo plano e na primeira leitura.
 */
export interface RefreshHint {
  changed: boolean;
}

interface Watch {
  table: string;
  /** Filtro do Realtime, ex.: `room_id=eq.<id>`. */
  filter?: string;
}

/**
 * Mantém uma tela sincronizada com o banco.
 * - Realtime avisa que algo mudou; a tela então recarrega pelo `refresh` (leitura com RLS).
 * - Polling de segurança cobre eventos perdidos e DELETEs que o Realtime não entrega com filtro.
 * - Ao voltar do segundo plano ou reconectar, recarrega o estado persistido.
 * O refresh nunca reenvia ações: só lê. Por isso reconectar não duplica jogadas.
 */
export function useLiveRefresh(
  key: string | null,
  watches: Watch[],
  refresh: (hint: RefreshHint) => Promise<void>,
  pollMs = 4000,
): { status: ConnectionStatus; refreshNow: () => Promise<void> } {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const running = useRef<Promise<void> | null>(null);
  const again = useRef(false);
  const changeSignal = useRef(false);

  // Uma leitura por vez. Pedido durante uma leitura agenda mais uma no fim, para não perder
  // a mudança que motivou o pedido (ex.: logo depois de uma jogada).
  const refreshNow = useCallback((): Promise<void> => {
    if (running.current) {
      again.current = true;
      return running.current;
    }
    const run = async () => {
      do {
        again.current = false;
        const changed = changeSignal.current;
        changeSignal.current = false;
        try {
          await refreshRef.current({ changed });
          // Leitura bem-sucedida: os dados estão em dia, mesmo que o Realtime esteja caído (o polling cobre).
          setStatus('online');
        } catch {
          setStatus('reconnecting');
        }
      } while (again.current);
      running.current = null;
    };
    running.current = run();
    return running.current;
  }, []);

  const watchKey = JSON.stringify(watches);

  useEffect(() => {
    if (!key) return;
    refreshNow();

    let channel = supabase.channel(channelTopic(key));
    for (const watch of JSON.parse(watchKey) as Watch[]) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: watch.table, filter: watch.filter },
        () => {
          changeSignal.current = true;
          refreshNow();
        },
      );
    }
    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        refreshNow();
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
        setStatus('reconnecting');
      }
    });

    const timer = setInterval(refreshNow, pollMs);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refreshNow();
    });

    return () => {
      clearInterval(timer);
      appState.remove();
      supabase.removeChannel(channel);
    };
  }, [key, watchKey, pollMs, refreshNow]);

  return { status, refreshNow };
}
