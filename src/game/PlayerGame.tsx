import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getLegalActions } from '../../supabase/functions/_shared/engine/game.ts';
import type { GameAction, GameResult, MatchPlayer, MatchView, PrivateHand, Seat } from '../contracts/types';
import { errorMessage } from '../lib/errors';
import type { ConnectionStatus } from '../lib/useLiveRefresh';
import { useScreenAwake } from '../lib/useScreenAwake';
import { colors, space } from '../ui/theme';
import { submitAction } from './api';
import { FinishedOverlay } from './components/FinishedOverlay';
import { HandPanel } from './components/HandPanel';
import { ScoreBar } from './components/ScoreBar';
import { ConnectionBanner, StatusBanner } from './components/StatusBanner';
import { TableBoard } from './components/TableBoard';
import { seatTeam } from './describe';
import { statusText } from './status';
import { useDealAnimation } from './useDealAnimation';
import { useEventBubble } from './useEventBubble';

interface Props {
  match: MatchView;
  hand: PrivateHand | null;
  players: MatchPlayer[];
  mySeat: Seat;
  connection: ConnectionStatus;
  refresh: () => Promise<void>;
  /** Envio da ação. Padrão: a Edge Function submit-action. A fixture de desenvolvimento injeta um simulador local. */
  submit?: (matchId: string, action: GameAction, expectedRevision: number) => Promise<GameResult>;
}

/** Modo jogador: mesa pública em cima, mão privada e controles embaixo. */
export function PlayerGame({ match, hand, players, mySeat, connection, refresh, submit = submitAction }: Props) {
  useScreenAwake();
  const insets = useSafeAreaInsets();
  const state = match.state;
  const deal = useDealAnimation(match.matchId, state);
  const bubble = useEventBubble(match);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Trava síncrona: dois toques rápidos não chegam a enviar duas ações.
  const sending = useRef(false);

  const myTeam = seatTeam(mySeat);
  const legal = getLegalActions(state, mySeat);
  const nameOf = (seat: Seat) =>
    seat === mySeat ? 'Você' : players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 4500);
    return () => clearTimeout(timer);
  }, [error]);

  async function act(key: string, action: GameAction) {
    if (sending.current) return;
    sending.current = true;
    setBusy(key);
    setError(null);
    try {
      // O servidor valida vez, carta e truco; aqui só vai a intenção com a revisão que este aparelho viu.
      const result = await submit(match.matchId, action, match.revision);
      if (!result.ok) setError(errorMessage(result.error));
      await refresh();
    } finally {
      sending.current = false;
      setBusy(null);
    }
  }

  function leaveTable() {
    Alert.alert('Sair da mesa?', 'A partida continua. Para voltar, abra a sala de novo pelo código.', [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Sair', onPress: () => router.replace('/') },
    ]);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }]}>
      <View style={styles.top}>
        <ScoreBar state={state} viewerTeam={myTeam} players={players} large={false} onLeave={leaveTable} />
        <ConnectionBanner status={connection} />
        <TableBoard
          state={state}
          players={players}
          bottomSeat={mySeat}
          viewerSeat={mySeat}
          deal={deal}
          variant="compact"
          bubble={bubble}
        />
        <StatusBanner
          status={statusText({ state, viewerSeat: mySeat, nameOf, canRespond: legal.respondTruco, phase: deal.phase })}
          large={false}
        />
      </View>

      <HandPanel
        state={state}
        hand={hand}
        mySeat={mySeat}
        legal={legal}
        deal={deal}
        busy={busy}
        error={error}
        onAct={act}
        bottomInset={insets.bottom}
      />

      {state.status === 'finished' ? (
        <FinishedOverlay
          state={state}
          viewerTeam={myTeam}
          onRoom={() => router.replace(match.roomCode ? `/room/${match.roomCode}` : '/')}
          onNote={() => router.push({ pathname: '/history/note', params: { matchId: match.matchId } })}
          onHome={() => router.replace('/')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.felt },
  top: { flex: 1, paddingHorizontal: space.sm, paddingBottom: space.sm, gap: space.xs },
});
