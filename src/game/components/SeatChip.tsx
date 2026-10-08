import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Team } from '../../contracts/types';
import { CARD_BACK } from '../../ui/PlayingCard';
import { colors, font, radius } from '../../ui/theme';
import type { Rect } from '../geometry';

interface Props {
  rect: Rect;
  name: string;
  /** "Nós", "Eles", "Dupla A"... */
  teamText: string;
  team: Team;
  isTurn: boolean;
  /** Cartas ainda na mão do lugar (versos); null para não mostrar (a própria mão já aparece embaixo). */
  cardsLeft: number | null;
  large: boolean;
}

/** Etiqueta de um lugar na mesa: nome, dupla, cartas na mão e destaque de quem é a vez. */
export function SeatChip({ rect, name, teamText, team, isTurn, cardsLeft, large }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (isTurn) {
      pulse.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(pulse);
      pulse.value = withTiming(0, { duration: 150 });
    }
  }, [isTurn, pulse]);

  const ring = useAnimatedStyle(() => ({
    opacity: isTurn ? 0.35 + pulse.value * 0.5 : 0,
    transform: [{ scale: 1 + pulse.value * 0.06 }],
  }));

  const teamColor = team === 'A' ? colors.teamA : colors.teamB;
  const backW = large ? 13 : 10;
  // Etiqueta estreita na mesa dedicada: dupla e cartas em linhas separadas, para nada ser cortado.
  const stacked = large && rect.w < 140;

  return (
    <View
      style={[styles.wrap, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      accessible
      accessibilityLabel={`${name}, ${teamText}${isTurn ? ', é a vez' : ''}${
        cardsLeft !== null ? `, ${cardsLeft} ${cardsLeft === 1 ? 'carta' : 'cartas'}` : ''
      }`}
    >
      <Animated.View pointerEvents="none" style={[styles.ring, ring]} />
      <View style={[styles.chip, isTurn && styles.chipTurn]}>
        <View style={[styles.teamBar, { backgroundColor: teamColor }]} />
        <View style={styles.body}>
          <Text style={[styles.name, large && styles.nameLarge, isTurn && styles.textTurn]} numberOfLines={1}>
            {isTurn ? '▶ ' : ''}
            {name}
          </Text>
          <View style={[styles.subRow, stacked && styles.subRowStacked]}>
            <Text style={[styles.team, large && styles.teamLarge, isTurn && styles.textTurn]} numberOfLines={1}>
              {teamText}
            </Text>
            {cardsLeft !== null && cardsLeft > 0 ? (
              <View style={styles.backs}>
                {Array.from({ length: cardsLeft }, (_, i) => (
                  <Image key={i} source={CARD_BACK} style={[styles.back, { width: backW, height: backW * 1.45 }]} />
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  ring: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: colors.gold,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: radius.sm,
    backgroundColor: '#00000059',
    overflow: 'hidden',
  },
  chipTurn: { backgroundColor: colors.gold },
  teamBar: { width: 5 },
  body: { flex: 1, paddingHorizontal: 6, justifyContent: 'center' },
  name: { color: colors.paper, fontSize: font.small, fontWeight: '800' },
  nameLarge: { fontSize: font.body },
  team: { color: colors.feltText, fontSize: font.small - 3, fontWeight: '600', flexShrink: 1 },
  teamLarge: { fontSize: font.small },
  textTurn: { color: colors.ink },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subRowStacked: { flexDirection: 'column', alignItems: 'flex-start', gap: 2 },
  backs: { flexDirection: 'row', gap: 2 },
  back: { borderRadius: 2 },
});
