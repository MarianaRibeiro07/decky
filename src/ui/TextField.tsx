import { StyleSheet, Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle } from 'react-native';
import { colors, font, radius, space, TOUCH_MIN } from './theme';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string | null;
  inputStyle?: StyleProp<TextStyle>;
}

export function TextField({ label, error, inputStyle, ...input }: Props) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null, inputStyle]}
        {...input}
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          ⚠ {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: space.xs },
  label: { fontSize: font.body, fontWeight: '700', color: colors.ink },
  input: {
    minHeight: TOUCH_MIN + 8,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    fontSize: font.large,
    color: colors.ink,
    backgroundColor: colors.paper,
  },
  inputError: { borderColor: colors.red },
  error: { fontSize: font.small + 1, color: colors.redDark, fontWeight: '600' },
});
