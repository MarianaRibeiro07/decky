import { StyleSheet, Text, View } from 'react-native';
import { colors, font, radius, space } from './theme';

type Kind = 'error' | 'success' | 'info';

/** Mensagem de feedback. Usa ícone e texto, não só cor. */
export function Notice({ kind, message }: { kind: Kind; message: string | null | undefined }) {
  if (!message) return null;
  const style = KINDS[kind];
  return (
    <View
      style={[styles.box, { backgroundColor: style.bg, borderColor: style.border }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.text, { color: style.text }]}>
        {style.icon} {message}
      </Text>
    </View>
  );
}

const KINDS: Record<Kind, { bg: string; border: string; text: string; icon: string }> = {
  error: { bg: colors.errorBg, border: colors.red, text: colors.redDark, icon: '⚠' },
  success: { bg: colors.successBg, border: colors.success, text: colors.success, icon: '✓' },
  info: { bg: colors.infoBg, border: colors.border, text: colors.ink, icon: 'ℹ' },
};

const styles = StyleSheet.create({
  box: { borderWidth: 2, borderRadius: radius.md, padding: space.md },
  text: { fontSize: font.body, fontWeight: '600' },
});
