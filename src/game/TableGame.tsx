import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MatchPlayer, MatchView, Seat } from '../contracts/types';
import type { ConnectionStatus } from '../lib/useLiveRefresh';
import { useScreenAwake } from '../lib/useScreenAwake';
import { colors, font, space } from '../ui/theme';
import { FinishedOverlay } from './components/FinishedOverlay';
import { ScoreBar } from './components/ScoreBar';
import { ConnectionBanner, StatusBanner } from './components/StatusBanner';
import { TableBoard } from './components/TableBoard';
import { statusText } from './status';
import { useDealAnimation } from './useDealAnimation';
import { useEventBubble } from './useEventBubble';

interface Props {
  match: MatchView;
  players: MatchPlayer[];
  connection: ConnectionStatus;
}

/**
 * Modo mesa: o celular do dono vira a mesa central, só com informações públicas.
 * Não tem mão nem botões de jogo; o servidor recusa ações deste aparelho.
 */
export function TableGame({ match, players, connection }: Props) {
  useScreenAwake();
  const insets = useSafeAreaInsets();
  const state = match.state;
  const deal = useDealAnimation(match.matchId, state);
  const bubble = useEventBubble(match);
  const nameOf = (seat: Seat) => players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;

  function leaveTable() {
    Alert.alert('Sair da mesa?', 'A partida continua nos celulares dos jogadores. Você pode abrir a mesa de novo pela sala.', [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Sair', onPress: () => router.replace('/') },
    ]);
  }

  return (
    <View
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom + space.xs,
          paddingLeft: insets.left + space.sm,
          paddingRight: insets.right + space.sm,
        },
      ]}
    >
      <ScoreBar state={state} viewerTeam={null} players={players} large onLeave={leaveTable} />
      <ConnectionBanner status={connection} />
      <StatusBanner status={statusText({ state, viewerSeat: null, nameOf, canRespond: false, phase: deal.phase })} large />
      <TableBoard state={state} players={players} bottomSeat={1} viewerSeat={null} deal={deal} variant="large" bubble={bubble} />
      <Text style={styles.footer} numberOfLines={1}>
        Mesa{match.roomCode ? ` · sala ${match.roomCode}` : ''} · mostra só o que é público
      </Text>

      {state.status === 'finished' ? (
        <FinishedOverlay
          state={state}
          viewerTeam={null}
          onRoom={() => router.replace(match.roomCode ? `/room/${match.roomCode}` : '/')}
          onHome={() => router.replace('/')}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.felt, gap: space.sm },
  footer: { color: colors.feltText, fontSize: font.small - 2, textAlign: 'center', opacity: 0.85 },
});
