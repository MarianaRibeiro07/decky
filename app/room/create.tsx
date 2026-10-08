import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { HostMode } from '../../src/contracts/types';
import { errorMessage } from '../../src/lib/errors';
import { createRoom } from '../../src/rooms/api';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space } from '../../src/ui/theme';

const OPTIONS: { mode: HostMode; title: string; devices: string; description: string }[] = [
  {
    mode: 'player',
    title: 'Vou jogar',
    devices: '4 celulares',
    description: 'Cada celular mostra a mesa em cima e a própria mão embaixo. Você ocupa um dos 4 lugares.',
  },
  {
    mode: 'table',
    title: 'Este celular será a mesa',
    devices: '4 celulares + esta mesa',
    description:
      'Deixe este aparelho no centro: ele mostra só a mesa, sem cartas de ninguém. Os 4 jogadores usam os próprios celulares.',
  },
];

/** Criar sala: o dono escolhe se joga ou se o aparelho dele vira a mesa central. */
export default function CreateRoom() {
  const [creating, setCreating] = useState<HostMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function create(mode: HostMode) {
    if (creating) return;
    setCreating(mode);
    setError(null);
    try {
      const room = await createRoom(mode);
      router.replace(`/room/${room.code}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setCreating(null);
    }
  }

  return (
    <Screen title="Criar sala">
      <Text style={styles.lead}>Como este celular vai participar?</Text>
      {OPTIONS.map((option) => (
        <Pressable
          key={option.mode}
          onPress={() => create(option.mode)}
          disabled={!!creating}
          accessibilityRole="button"
          accessibilityLabel={`${option.title}. ${option.devices}. ${option.description}`}
          accessibilityState={{ busy: creating === option.mode, disabled: !!creating }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed, creating && creating !== option.mode && styles.faded]}
        >
          <View style={styles.optionHead}>
            <Text style={styles.optionTitle}>{option.title}</Text>
            <Text style={styles.devices}>{option.devices}</Text>
          </View>
          <Text style={styles.description}>{option.description}</Text>
          <Text style={styles.cta}>{creating === option.mode ? 'Criando sala…' : 'Criar assim ›'}</Text>
        </Pressable>
      ))}
      <Text style={styles.note}>Dá para trocar no lobby, antes de começar.</Text>
      <Notice kind="error" message={error} />
      <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { fontSize: font.large, fontWeight: '700', color: colors.ink },
  option: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.ink,
    padding: space.md,
    gap: space.xs,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  faded: { opacity: 0.45 },
  optionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, flexWrap: 'wrap' },
  optionTitle: { fontSize: font.large, fontWeight: '900', color: colors.ink, flexShrink: 1 },
  devices: {
    fontSize: font.small - 1,
    fontWeight: '800',
    color: colors.paper,
    backgroundColor: colors.felt,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  description: { fontSize: font.body - 1, color: colors.muted },
  cta: { fontSize: font.body, fontWeight: '800', color: colors.red, marginTop: space.xs },
  note: { fontSize: font.small, color: colors.muted, textAlign: 'center' },
});
