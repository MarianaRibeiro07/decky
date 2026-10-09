import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Backdrop } from './Backdrop';
import { TitleRule } from './Ornament';
import { colors, fonts, space } from './theme';

interface Props {
  title?: string;
  /** Linha de apoio abaixo do título. */
  subtitle?: string;
  children: ReactNode;
  /** Conteúdo rolável (formulários e listas). */
  scroll?: boolean;
}

/** Moldura das telas fora da partida: salão escuro, área segura e título com filete dourado. */
export function Screen({ title, subtitle, children, scroll = true }: Props) {
  const body = (
    <View style={styles.content}>
      {title ? (
        <View style={styles.head}>
          <Text style={styles.title} accessibilityRole="header">
            {title}
          </Text>
          <TitleRule />
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <View style={styles.root}>
      <Backdrop />
      <SafeAreaView style={styles.flex}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {scroll ? (
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
              // iOS: arrastar a tela para baixo recolhe o teclado acompanhando o dedo, como nos apps nativos.
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              {body}
            </ScrollView>
          ) : (
            body
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { flex: 1, width: '100%', maxWidth: 560, alignSelf: 'center', padding: space.lg, gap: space.md },
  head: { gap: space.sm, marginBottom: space.xs },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 40, color: colors.text },
  subtitle: { fontSize: 16, color: colors.textMuted },
});
