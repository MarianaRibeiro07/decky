import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { signOut, useAuth } from '../src/auth/AuthProvider';
import { errorMessage } from '../src/lib/errors';
import { createRoom } from '../src/rooms/api';
import { Button } from '../src/ui/Button';
import { Logo } from '../src/ui/Logo';
import { Notice } from '../src/ui/Notice';
import { Screen } from '../src/ui/Screen';
import { colors, font } from '../src/ui/theme';

export default function Home() {
  const { displayName } = useAuth();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const room = await createRoom();
      router.push(`/room/${room.code}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(false);
    }
  }

  return (
    <Screen>
      <Logo size={150} />
      <Text style={styles.greeting} accessibilityRole="header">
        Olá, {displayName}!
      </Text>
      <Notice kind="error" message={error} />
      <Button label="Criar sala" onPress={handleCreate} loading={creating} hint="Cria uma sala e mostra o código para os amigos" />
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
