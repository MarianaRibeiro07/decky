import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { HostMode } from '../../src/contracts/types';
import { errorMessage } from '../../src/lib/errors';
import { createRoom } from '../../src/rooms/api';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { colors, font, fonts, radius, shadow, space } from '../../src/ui/theme';

const OPTIONS: { mode: HostMode; glyph: string; title: string; devices: string; description: string }[] = [
  {
    mode: 'player',
    glyph: '♠',
    title: 'Vou jogar',
    devices: '4 celulares',
    description: 'Cada celular mostra a mesa em cima e a própria mão embaixo. Você ocupa um dos 4 lugares.',
  },
  {
    mode: 'table',
    glyph: '◎',
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
    <Screen title="Criar sala" subtitle="Como este celular vai participar?">
      {OPTIONS.map((option) => {
        const isCreating = creating === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => create(option.mode)}
            disabled={!!creating}
            accessibilityRole="button"
            accessibilityLabel={`${option.title}. ${option.devices}. ${option.description}`}
            accessibilityState={{ busy: isCreating, disabled: !!creating }}
            style={({ pressed }) => [styles.option, pressed && styles.pressed, creating && !isCreating && styles.faded]}
          >
            <View style={styles.optionHead}>
              <Text style={styles.glyph}>{option.glyph}</Text>
              <Text style={styles.optionTitle}>{option.title}</Text>
            </View>
            <Text style={styles.devices}>{option.devices}</Text>
            <Text style={styles.description}>{option.description}</Text>
            <View style={styles.ctaRow}>
              {isCreating ? <ActivityIndicator color={colors.redText} size="small" /> : null}
              <Text style={styles.cta}>{isCreating ? 'Criando sala…' : 'Criar assim ›'}</Text>
            </View>
          </Pressable>
        );
      })}
      <Text style={styles.note}>Dá para trocar no lobby, antes de começar.</Text>
      <Notice kind="error" message={error} />
      <Button label="Voltar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: space.md,
    gap: space.xs + 2,
    boxShadow: shadow.panel,
  },
  pressed: { backgroundColor: colors.surfaceRaised, borderColor: colors.goldDeep, transform: [{ scale: 0.99 }] },
  faded: { opacity: 0.45 },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  glyph: { fontSize: 22, color: colors.gold, width: 26, textAlign: 'center' },
  optionTitle: { fontFamily: fonts.display, fontSize: font.large, lineHeight: 30, color: colors.text, flexShrink: 1 },
  devices: {
    alignSelf: 'flex-start',
    fontSize: font.small - 2,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: colors.goldSoft,
    borderColor: colors.goldDeep,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
  },
  description: { fontSize: font.body - 2, lineHeight: 23, color: colors.textMuted },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  cta: { fontSize: font.body - 1, fontWeight: '800', color: colors.redText },
  note: { fontSize: font.small, color: colors.textFaint, textAlign: 'center' },
});
