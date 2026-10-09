import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MatchPlayer, PublicGameState, Team } from '../../contracts/types';
import { colors, font, radius, space, TOUCH_MIN } from '../../ui/theme';
import { describeTrick, teamLabel, trucoName } from '../describe';

interface Props {
  state: PublicGameState;
  /** Dupla de quem olha; null na mesa central. */
  viewerTeam: Team | null;
  players: MatchPlayer[];
  large: boolean;
  onLeave: () => void;
}

/** Placar das duplas, valor da mão e vazas da mão atual. */
export function ScoreBar({ state, viewerTeam, players, large, onLeave }: Props) {
  // Para o jogador, "Nós" fica sempre à esquerda; na mesa, A à esquerda.
  const left: Team = viewerTeam ?? 'A';
  const right: Team = left === 'A' ? 'B' : 'A';
  const members = (team: Team) =>
    players
      .filter((p) => p.team === team)
      .map((p) => p.displayName)
      .join(' e ');

  const value = state.truco ? `${state.handValue} → ${trucoName(state.truco.value)}?` : `Vale ${state.handValue}`;

  return (
    <View style={[styles.bar, large && styles.barLarge]}>
      <Pressable
        onPress={onLeave}
        style={({ pressed }) => [styles.leave, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel="Sair da mesa"
        hitSlop={8}
      >
        <Text style={styles.leaveText}>✕</Text>
      </Pressable>

      <View
        style={styles.score}
        accessible
        accessibilityLabel={`Placar: ${teamLabel(left, viewerTeam)} ${state.score[left]}, ${teamLabel(right, viewerTeam)} ${state.score[right]}. Partida até 12.`}
      >
        <TeamScore team={left} label={teamLabel(left, viewerTeam)} points={state.score[left]} names={large ? members(left) : null} large={large} />
        <Text style={[styles.x, large && styles.xLarge]}>×</Text>
        <TeamScore team={right} label={teamLabel(right, viewerTeam)} points={state.score[right]} names={large ? members(right) : null} large={large} />
      </View>

      <View
        style={styles.hand}
        accessible
        accessibilityLabel={`Mão ${state.handNumber}, vale ${state.handValue}. Vazas: ${
          state.trickResults.map((r) => describeTrick(r, viewerTeam)).join(', ') || 'nenhuma'
        }`}
      >
        <Text style={[styles.value, large && styles.valueLarge, state.truco && styles.valueTruco]} numberOfLines={1}>
          {value}
        </Text>
        <View style={styles.tricks}>
          {[0, 1, 2].map((i) => (
            <TrickDot key={i} result={state.trickResults[i]} viewerTeam={viewerTeam} large={large} />
          ))}
        </View>
      </View>
    </View>
  );
}

function TeamScore({ team, label, points, names, large }: { team: Team; label: string; points: number; names: string | null; large: boolean }) {
  return (
    <View style={styles.team}>
      <View style={styles.teamHead}>
        <View style={[styles.teamDot, { backgroundColor: team === 'A' ? colors.teamA : colors.teamB }]} />
        <Text style={[styles.teamLabel, large && styles.teamLabelLarge]}>{label}</Text>
      </View>
      <Text style={[styles.points, large && styles.pointsLarge]}>{points}</Text>
      {names ? (
        <Text style={styles.names} numberOfLines={1}>
          {names}
        </Text>
      ) : null}
    </View>
  );
}

function TrickDot({ result, viewerTeam, large }: { result: 'A' | 'B' | 'tie' | undefined; viewerTeam: Team | null; large: boolean }) {
  const size = large ? 26 : 18;
  let bg = 'transparent';
  let label = '';
  if (result === 'tie') {
    bg = colors.feltText;
    label = '=';
  } else if (result) {
    bg = result === 'A' ? colors.teamA : colors.teamB;
    label = viewerTeam ? (result === viewerTeam ? 'N' : 'E') : result;
  }
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.dotText, result === 'tie' && { color: colors.ink }, large && { fontSize: 13 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xs },
  barLarge: { paddingVertical: space.sm },
  leave: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: radius.md,
    backgroundColor: '#00000040',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leaveText: { color: colors.paper, fontSize: font.large, fontWeight: '800' },
  score: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  team: { alignItems: 'center', minWidth: 56 },
  teamHead: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  teamDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1, borderColor: colors.paper },
  teamLabel: { color: colors.feltText, fontSize: font.small - 1, fontWeight: '800' },
  teamLabelLarge: { fontSize: font.body },
  points: { color: colors.paper, fontSize: 30, fontWeight: '900', lineHeight: 34 },
  pointsLarge: { fontSize: 56, lineHeight: 62 },
  names: { color: colors.feltText, fontSize: font.small - 2, maxWidth: 130 },
  x: { color: colors.feltText, fontSize: font.large },
  xLarge: { fontSize: font.title },
  hand: { alignItems: 'flex-end', gap: 4, minWidth: 84 },
  value: { color: colors.gold, fontSize: font.body, fontWeight: '900' },
  valueLarge: { fontSize: font.title },
  valueTruco: { color: colors.paper },
  tricks: { flexDirection: 'row', gap: 4 },
  dot: { borderWidth: 2, borderColor: colors.feltText, alignItems: 'center', justifyContent: 'center' },
  dotText: { color: colors.paper, fontSize: 10, fontWeight: '900' },
});
