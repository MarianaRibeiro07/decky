import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import type { RoomSeat, Seat } from '../../src/contracts/types';
import { startMatch } from '../../src/game/api';
import { errorMessage } from '../../src/lib/errors';
import { changeSeat, leaveRoom, setReady } from '../../src/rooms/api';
import { useRoom } from '../../src/rooms/useRoom';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space, TOUCH_MIN } from '../../src/ui/theme';

// Grade em volta da mesa: parceiros ficam na diagonal (1 e 3, 2 e 4).
const GRID: Seat[][] = [
  [1, 2],
  [4, 3],
];

export default function Lobby() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const { userId } = useAuth();
  const { room, seats, activeMatchId, gone, loaded, connection, refresh } = useRoom(code);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Partida começou (por este aparelho ou pelo dono): todos vão para a mesa.
  useEffect(() => {
    if (activeMatchId) router.replace(`/game/${activeMatchId}`);
  }, [activeMatchId]);

  const me = seats.find((s) => s.userId === userId);
  const isHost = !!room && room.hostUserId === userId;
  const allReady = seats.length === 4 && seats.every((s) => s.ready);

  async function run(key: string, action: () => Promise<unknown>) {
    setBusy(key);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleStart() {
    if (!room) return;
    setBusy('start');
    setError(null);
    const result = await startMatch(room.id);
    setBusy(null);
    if (result.ok) router.replace(`/game/${result.matchId}`);
    else setError(errorMessage(result.error));
  }

  async function handleLeave() {
    if (room) await run('leave', () => leaveRoom(room.id));
    router.replace('/');
  }

  if (loaded && (gone || !me)) {
    return (
      <Screen title="Sala indisponível">
        <Notice kind="info" message="Esta sala não existe mais ou você não está nela." />
        <Button label="Voltar ao início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.codeBox}>
        <Text style={styles.codeLabel}>Código da sala</Text>
        <Text style={styles.code} accessibilityLabel={`Código ${code?.split('').join(' ')}`} selectable>
          {code}
        </Text>
        <Button
          label="Compartilhar código"
          variant="secondary"
          onPress={() => Share.share({ message: `Vem jogar truco no Decky! Código da sala: ${code}` })}
        />
      </View>

      {connection === 'reconnecting' ? <Notice kind="info" message="Reconectando..." /> : null}
      <Text style={styles.teams}>Dupla A: lugares 1 e 3 · Dupla B: lugares 2 e 4</Text>

      <View style={styles.grid}>
        {GRID.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((seat) => (
              <SeatBox
                key={seat}
                seat={seat}
                player={seats.find((s) => s.seat === seat)}
                isMe={me?.seat === seat}
                hostId={room?.hostUserId}
                disabled={!!busy}
                onSit={() => room && run(`seat-${seat}`, () => changeSeat(room.id, seat))}
              />
            ))}
          </View>
        ))}
      </View>

      <Notice kind="error" message={error} />

      {me ? (
        <Button
          label={me.ready ? 'Não estou pronto' : 'Estou pronto'}
          variant={me.ready ? 'secondary' : 'dark'}
          loading={busy === 'ready'}
          onPress={() => room && run('ready', () => setReady(room.id, !me.ready))}
        />
      ) : null}

      {isHost ? (
        <Button
          label={allReady ? 'Iniciar partida' : `Iniciar (${seats.filter((s) => s.ready).length}/4 prontos)`}
          disabled={!allReady}
          loading={busy === 'start'}
          onPress={handleStart}
        />
      ) : (
        <Text style={styles.waiting}>Aguardando quem criou a sala iniciar.</Text>
      )}

      <Button label="Sair da sala" variant="secondary" onPress={handleLeave} loading={busy === 'leave'} />
    </Screen>
  );
}

interface SeatBoxProps {
  seat: Seat;
  player: RoomSeat | undefined;
  isMe: boolean;
  hostId: string | undefined;
  disabled: boolean;
  onSit: () => void;
}

function SeatBox({ seat, player, isMe, hostId, disabled, onSit }: SeatBoxProps) {
  const team = seat % 2 === 1 ? 'A' : 'B';
  const teamColor = team === 'A' ? colors.teamA : colors.teamB;
  const header = `Lugar ${seat} · Dupla ${team}`;

  if (!player) {
    return (
      <Pressable
        style={({ pressed }) => [styles.seat, styles.seatFree, pressed && { opacity: 0.7 }]}
        onPress={onSit}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${header}, livre. Toque para sentar aqui`}
      >
        <Text style={[styles.seatHeader, { color: teamColor }]}>{header}</Text>
        <Text style={styles.free}>Livre</Text>
        <Text style={styles.freeHint}>Toque para sentar</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.seat, { borderColor: teamColor }, isMe && styles.seatMe]}
      accessible
      accessibilityLabel={`${header}, ${player.displayName}${isMe ? ', você' : ''}, ${player.ready ? 'pronto' : 'aguardando'}`}
    >
      <Text style={[styles.seatHeader, { color: teamColor }]}>{header}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {player.displayName}
        {isMe ? ' (você)' : ''}
      </Text>
      {player.userId === hostId ? <Text style={styles.host}>Dono da sala</Text> : null}
      <Text style={[styles.ready, { color: player.ready ? colors.success : colors.muted }]}>
        {player.ready ? '✓ Pronto' : '… Aguardando'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    backgroundColor: colors.ink,
    borderRadius: radius.lg,
    padding: space.md,
    gap: space.sm,
    alignItems: 'stretch',
  },
  codeLabel: { color: colors.feltText, fontSize: font.body, textAlign: 'center' },
  code: { color: colors.paper, fontSize: font.huge + 6, fontWeight: '900', letterSpacing: 8, textAlign: 'center' },
  teams: { fontSize: font.small + 1, color: colors.muted, textAlign: 'center' },
  grid: { gap: space.sm, backgroundColor: colors.felt, borderRadius: radius.lg, padding: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  seat: {
    flex: 1,
    minHeight: TOUCH_MIN * 2.4,
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 3,
    padding: space.sm,
    justifyContent: 'center',
    gap: 2,
  },
  seatFree: { borderStyle: 'dashed', borderColor: colors.border, backgroundColor: colors.cream, alignItems: 'center' },
  seatMe: { backgroundColor: '#FFF7DC' },
  seatHeader: { fontSize: font.small, fontWeight: '800' },
  name: { fontSize: font.large, fontWeight: '800', color: colors.ink },
  host: { fontSize: font.small, color: colors.muted },
  ready: { fontSize: font.body, fontWeight: '700' },
  free: { fontSize: font.large, fontWeight: '700', color: colors.muted },
  freeHint: { fontSize: font.small, color: colors.muted },
  waiting: { fontSize: font.body, color: colors.muted, textAlign: 'center' },
});
