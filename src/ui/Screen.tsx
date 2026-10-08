import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, space } from './theme';

interface Props {
  title?: string;
  children: ReactNode;
  /** Conteúdo rolável (formulários e listas). */
  scroll?: boolean;
}

export function Screen({ title, children, scroll = true }: Props) {
  const body = (
    <View style={styles.content}>
      {title ? (
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, padding: space.lg, gap: space.md },
  title: { fontSize: font.title, fontWeight: '800', color: colors.ink },
});
