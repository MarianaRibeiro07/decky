import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { supabase } from './supabase';

export type ConnectionStatus = 'connecting' | 'online' | 'reconnecting';

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
  refresh: () => Promise<void>,
  pollMs = 4000,
): { status: ConnectionStatus; refreshNow: () => Promise<void> } {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const running = useRef(false);

  const refreshNow = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      await refreshRef.current();
      setStatus((s) => (s === 'connecting' ? 'online' : s));
    } catch {
      setStatus('reconnecting');
    } finally {
      running.current = false;
    }
  }, []);

  const watchKey = JSON.stringify(watches);

  useEffect(() => {
    if (!key) return;
    refreshNow();

    let channel = supabase.channel(`live:${key}`);
    for (const watch of JSON.parse(watchKey) as Watch[]) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: watch.table, filter: watch.filter },
        () => refreshNow(),
      );
    }
    channel.subscribe((state) => {
      if (state === 'SUBSCRIBED') {
        setStatus('online');
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
