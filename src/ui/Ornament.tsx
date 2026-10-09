import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from './theme';

const SUITS = [
  { glyph: '♠', red: false },
  { glyph: '♥', red: true },
  { glyph: '♦', red: true },
  { glyph: '♣', red: false },
];

/** Filete metálico com os quatro naipes, como a gravação de uma mesa. Decorativo: oculto para leitores de tela. */
export function Ornament({ width = 260 }: { width?: number }) {
  return (
    <View style={[styles.row, { width }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.line} />
      {SUITS.map((s) => (
        <Text key={s.glyph} style={[styles.suit, { color: s.red ? colors.red : colors.metal }]}>
          {s.glyph}
        </Text>
      ))}
      <View style={styles.line} />
    </View>
  );
}

/** Filete curto dourado sob títulos. */
export function TitleRule() {
  return <View style={styles.rule} accessibilityElementsHidden importantForAccessibility="no" />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: space.sm },
  line: { flex: 1, height: 1, backgroundColor: colors.lineStrong },
  suit: { fontSize: 15, lineHeight: 18 },
  rule: { width: 36, height: 2, borderRadius: 1, backgroundColor: colors.gold, opacity: 0.85 },
});
