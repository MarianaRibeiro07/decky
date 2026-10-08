import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import type { PublicGameState, Team } from '../../contracts/types';
import { Button } from '../../ui/Button';
import { colors, font, radius, space } from '../../ui/theme';
import { teamLabel } from '../describe';

interface Props {
  state: PublicGameState;
  /** Dupla de quem olha; null na mesa central. */
  viewerTeam: Team | null;
  onRoom: () => void;
  onHome: () => void;
  /** Só jogadores escrevem nota (a nota é ligada a uma partida que a pessoa jogou). */
  onNote?: () => void;
}

/** Fim de partida: dupla vencedora e próximos passos. */
export function FinishedOverlay({ state, viewerTeam, onRoom, onHome, onNote }: Props) {
  const winner = state.winnerTeam;
  const title =
    winner === null
      ? 'Partida encerrada'
      : viewerTeam === null
        ? `Dupla ${winner} venceu!`
        : winner === viewerTeam
          ? 'Vocês venceram!'
          : 'Eles venceram';
  const left: Team = viewerTeam ?? 'A';
  const right: Team = left === 'A' ? 'B' : 'A';

  return (
    <Animated.View entering={FadeIn.duration(250)} style={styles.overlay}>
      <Animated.View entering={ZoomIn.duration(300)} style={styles.card} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.score}>
          {teamLabel(left, viewerTeam)} {state.score[left]} × {state.score[right]} {teamLabel(right, viewerTeam)}
        </Text>
        <Button label="Voltar para a sala" onPress={onRoom} />
        {onNote ? <Button label="Escrever nota sobre a partida" variant="dark" onPress={onNote} /> : null}
        <Button label="Início" variant="secondary" onPress={onHome} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000000AA', justifyContent: 'center', padding: space.lg },
  card: { backgroundColor: colors.cream, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  title: { fontSize: font.title + 4, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  score: { fontSize: font.large, fontWeight: '700', color: colors.muted, textAlign: 'center' },
});
