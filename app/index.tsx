import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { signOut, useAuth } from '../src/auth/AuthProvider';
import { Button } from '../src/ui/Button';
import { Logo } from '../src/ui/Logo';
import { Screen } from '../src/ui/Screen';
import { colors, font } from '../src/ui/theme';

export default function Home() {
  const { displayName } = useAuth();

  return (
    <Screen>
      <Logo size={150} />
      <Text style={styles.greeting} accessibilityRole="header">
        Olá, {displayName}!
      </Text>
      <Button label="Criar sala" onPress={() => router.push('/room/create')} hint="Escolha se você joga ou se este celular vira a mesa" />
      <Button label="Entrar na sala" variant="dark" onPress={() => router.push('/room/join')} />
      <Button label="Histórico e notas" variant="secondary" onPress={() => router.push('/history')} />
      <Button label="Sair da conta" variant="secondary" onPress={signOut} style={styles.logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  greeting: { fontSize: font.title, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  logout: { marginTop: 'auto' },
});
