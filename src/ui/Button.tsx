import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, font, radius, shadow, space, TOUCH_MIN } from './theme';

/**
 * - primary: laca vermelha do logo (ação principal da tela);
 * - dark: grafite com contorno metálico (ação importante, secundária);
 * - secondary: contorno discreto, sem preenchimento;
 * - gold: bronze, para a ação de destaque da mesa (uso raro);
 * - ghost: só texto (sair, cancelar).
 */
type Variant = 'primary' | 'secondary' | 'dark' | 'gold' | 'ghost';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  /** Linha menor abaixo do rótulo (menu inicial). */
  caption?: string;
  /** Texto extra para leitores de tela. */
  hint?: string;
  /** 'compact' para fileiras de ações lado a lado (mantém o alvo de toque mínimo). */
  size?: 'normal' | 'compact';
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, caption, hint, size = 'normal', style }: Props) {
  const inactive = disabled || loading;
  const palette = VARIANTS[variant];
  const compact = size === 'compact';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        { backgroundColor: palette.bg, borderColor: palette.border },
        palette.raised && !inactive && styles.raised,
        pressed && { backgroundColor: palette.pressed, transform: [{ scale: 0.98 }] },
        inactive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <View style={styles.texts}>
          <Text
            style={[styles.label, compact && styles.labelCompact, { color: palette.text }]}
            maxFontSizeMultiplier={compact ? 1.3 : 1.6}
            numberOfLines={compact ? 2 : undefined}
          >
            {label}
          </Text>
          {caption ? (
            <Text style={[styles.caption, { color: palette.caption }]} maxFontSizeMultiplier={1.4}>
              {caption}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; text: string; caption: string; border: string; raised: boolean }> = {
  primary: { bg: '#A80E27', pressed: colors.redDeep, text: colors.cream, caption: '#F3C9CF', border: '#D0263F', raised: true },
  dark: { bg: colors.surfaceRaised, pressed: colors.surface, text: colors.text, caption: colors.textMuted, border: colors.lineStrong, raised: true },
  secondary: { bg: 'transparent', pressed: '#FFFFFF0F', text: colors.text, caption: colors.textMuted, border: colors.line, raised: false },
  gold: { bg: '#2A2216', pressed: '#1E1810', text: colors.goldSoft, caption: colors.gold, border: colors.gold, raised: true },
  ghost: { bg: 'transparent', pressed: '#FFFFFF0F', text: colors.textMuted, caption: colors.textFaint, border: 'transparent', raised: false },
};

const styles = StyleSheet.create({
  base: {
    minHeight: TOUCH_MIN + 10,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  raised: { boxShadow: shadow.button },
  compact: { minHeight: TOUCH_MIN + 4, paddingHorizontal: space.sm, paddingVertical: space.xs },
  texts: { alignItems: 'center', gap: 2 },
  label: { fontSize: font.body + 1, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
  labelCompact: { fontSize: font.body - 1, fontWeight: '800', letterSpacing: 0 },
  caption: { fontSize: font.small - 2, textAlign: 'center' },
  disabled: { opacity: 0.42 },
});
