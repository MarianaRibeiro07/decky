// Quais botões de truco aparecem para quem está jogando. Só espelha getLegalActions do motor:
// o servidor valida de novo cada ação, então esconder botão aqui é conforto, não segurança.
import type { LegalActions } from '../../supabase/functions/_shared/engine/game.ts';
import type { GameAction, PublicGameState } from '../contracts/types';
import { nextTrucoValue, trucoName } from './describe';

export type ControlId = 'request' | 'accept' | 'refuse' | 'raise' | 'fold';

export interface Control {
  id: ControlId;
  label: string;
  hint: string;
  variant: 'primary' | 'secondary' | 'dark' | 'gold';
  /** Ação enviada ao servidor. Correr sem pedido pendente pede confirmação antes. */
  action: GameAction;
  confirm: boolean;
}

export type ControlsMode =
  /** Há pedido de truco e esta dupla responde. */
  | 'respond'
  /** Há pedido de truco feito pela própria dupla: só aguardar. */
  | 'waiting_answer'
  /** Jogo normal: jogar carta, pedir truco, correr. */
  | 'play'
  | 'none';

export function trucoControls(state: PublicGameState, legal: LegalActions): { mode: ControlsMode; controls: Control[] } {
  if (state.status !== 'playing') return { mode: 'none', controls: [] };

  if (state.truco) {
    if (!legal.respondTruco) return { mode: 'waiting_answer', controls: [] };
    const value = state.truco.value;
    const controls: Control[] = [
      {
        id: 'accept',
        label: 'Aceitar',
        hint: `A mão passa a valer ${value}`,
        variant: 'dark',
        action: { type: 'respond_truco', response: 'accept' },
        confirm: false,
      },
      {
        id: 'refuse',
        label: 'Correr',
        hint: `A outra dupla ganha ${state.handValue} ${state.handValue === 1 ? 'ponto' : 'pontos'}`,
        variant: 'secondary',
        action: { type: 'respond_truco', response: 'refuse' },
        confirm: false,
      },
    ];
    if (legal.raiseTruco) {
      const raised = nextTrucoValue(value);
      controls.push({
        id: 'raise',
        label: `Pedir ${trucoName(raised)}`,
        hint: `Aceita o ${trucoName(value).toLowerCase()} e pede para a mão valer ${raised}`,
        variant: 'gold',
        action: { type: 'respond_truco', response: 'raise' },
        confirm: false,
      });
    }
    return { mode: 'respond', controls };
  }

  const controls: Control[] = [];
  if (legal.requestTruco && legal.nextTrucoValue) {
    controls.push({
      id: 'request',
      label: `Pedir ${trucoName(legal.nextTrucoValue)}`,
      hint: `Pede para a mão valer ${legal.nextTrucoValue}`,
      variant: 'gold',
      action: { type: 'request_truco' },
      confirm: false,
    });
  }
  if (legal.fold) {
    controls.push({
      id: 'fold',
      label: 'Correr',
      hint: 'Desiste da mão; a outra dupla ganha os pontos',
      variant: 'secondary',
      action: { type: 'fold' },
      confirm: true,
    });
  }
  return { mode: 'play', controls };
}
