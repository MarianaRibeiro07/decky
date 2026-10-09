import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import { PlayerGame } from '../../src/game/PlayerGame';
import { TableGame } from '../../src/game/TableGame';
import { useMatch } from '../../src/game/useMatch';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { colors } from '../../src/ui/theme';

/**
 * Partida. O papel deste aparelho vem do servidor: quem está em match_players joga
 * (com mão privada); o table_user_id da partida vê a mesa central, sem mão.
 */
export default function Game() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { userId } = useAuth();
  const { match, hand, players, role, loaded, notFound, connection, refresh } = useMatch(matchId, userId);

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  if (notFound || !match || !role) {
    return (
      <Screen title="Partida indisponível">
        <Notice kind="info" message="Esta partida não existe ou você não participa dela." />
        <Button label="Voltar ao início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (role === 'table') {
    return <TableGame match={match} players={players} connection={connection} />;
  }

  const mySeat = hand?.seat ?? players.find((p) => p.userId === userId)?.seat;
  if (!mySeat) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.gold} />
      </View>
    );
  }

  return <PlayerGame match={match} hand={hand} players={players} mySeat={mySeat} connection={connection} refresh={refresh} />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
