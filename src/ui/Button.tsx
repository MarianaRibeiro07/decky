import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, space, TOUCH_MIN } from './theme';

type Variant = 'primary' | 'secondary' | 'dark' | 'gold';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Texto extra para leitores de tela. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, hint, style }: Props) {
  const inactive = disabled || loading;
  const palette = VARIANTS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && styles.pressed,
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, { color: palette.text }]} maxFontSizeMultiplier={1.6}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.red, text: colors.paper, border: colors.red },
  secondary: { bg: colors.paper, text: colors.ink, border: colors.ink },
  dark: { bg: colors.ink, text: colors.paper, border: colors.ink },
  gold: { bg: colors.gold, text: colors.ink, border: colors.gold },
};

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN + 8,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: font.large,
    fontWeight: '700',
    textAlign: 'center',
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.45 },
});
