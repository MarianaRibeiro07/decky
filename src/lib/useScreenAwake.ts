import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect } from 'react';

const TAG = 'decky-partida';

/**
 * Mantém a tela acesa enquanto a partida está aberta (a mesa central e quem espera a vez).
 * Diferente do useKeepAwake da biblioteca, nunca derruba o app: sair da tela antes de o bloqueio
 * ativar (ou um aparelho sem suporte) só é ignorado, porque manter a tela acesa é conforto.
 */
export function useScreenAwake() {
  useEffect(() => {
    let active = true;
    const activation = activateKeepAwakeAsync(TAG).catch(() => {
      active = false;
    });
    return () => {
      activation.then(() => {
        if (active) deactivateKeepAwake(TAG).catch(() => {});
      });
    };
  }, []);
}
