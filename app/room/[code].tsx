import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import type { HostMode, RoomSeat, Seat } from '../../src/contracts/types';
import { startMatch } from '../../src/game/api';
import { errorMessage } from '../../src/lib/errors';
import { changeSeat, leaveRoom, setHostMode, setReady } from '../../src/rooms/api';
import { useRoom } from '../../src/rooms/useRoom';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Panel } from '../../src/ui/Panel';
import { Screen } from '../../src/ui/Screen';
import { FeltPanel } from '../../src/ui/TableSurface';
import { colors, font, fonts, radius, space, TOUCH_MIN } from '../../src/ui/theme';

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
  const tableMode = room?.hostMode === 'table';
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

  // No modo mesa o dono não ocupa lugar, mas continua na sala.
  if (loaded && (gone || (!me && !isHost))) {
    return (
      <Screen title="Sala indisponível">
        <Notice kind="info" message="Esta sala não existe mais ou você não está nela." />
        <Button label="Voltar ao início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Panel tone="accent" style={styles.codeBox}>
        <Text style={styles.codeLabel}>CÓDIGO DA SALA</Text>
        <Text style={styles.code} accessibilityLabel={`Código ${code?.split('').join(' ')}`} selectable>
          {code}
        </Text>
        <Button
          label="Compartilhar código"
          variant="dark"
          size="compact"
          onPress={() => Share.share({ message: `Vem jogar truco no Decky! Código da sala: ${code}` })}
        />
      </Panel>

      {connection === 'reconnecting' ? <Notice kind="info" message="Reconectando..." /> : null}

      {room ? (
        <ModeBox
          mode={room.hostMode}
          isHost={isHost}
          busy={busy === 'mode'}
          disabled={!!busy}
          onSwitch={(mode) => run('mode', () => setHostMode(room.id, mode))}
        />
      ) : null}

      <FeltPanel>
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
                  // A mesa não senta: para ela, lugar livre só mostra que falta jogador.
                  canSit={!!me}
                  onSit={() => room && run(`seat-${seat}`, () => changeSeat(room.id, seat))}
                />
              ))}
            </View>
          ))}
        </View>
      </FeltPanel>

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
          label={
            allReady
              ? 'Iniciar partida'
              : seats.length < 4
                ? `Aguardando jogadores (${seats.length}/4)`
                : `Iniciar (${seats.filter((s) => s.ready).length}/4 prontos)`
          }
          disabled={!allReady}
          loading={busy === 'start'}
          onPress={handleStart}
        />
      ) : (
        <Text style={styles.waiting}>
          {tableMode ? 'Aguardando a mesa (quem criou a sala) iniciar.' : 'Aguardando quem criou a sala iniciar.'}
        </Text>
      )}

      <Button label="Sair da sala" variant="ghost" onPress={handleLeave} loading={busy === 'leave'} />
    </Screen>
  );
}

interface ModeBoxProps {
  mode: HostMode;
  isHost: boolean;
  busy: boolean;
  disabled: boolean;
  onSwitch: (mode: HostMode) => void;
}

/** Mostra como a sala funciona (dono joga ou é a mesa) e, para o dono, permite trocar no lobby. */
function ModeBox({ mode, isHost, busy, disabled, onSwitch }: ModeBoxProps) {
  const table = mode === 'table';
  const title = table
    ? isHost
      ? 'Este celular é a mesa'
      : 'Mesa central ativa'
    : isHost
      ? 'Você joga nesta sala'
      : 'Quem criou a sala também joga';
  const description = table
    ? isHost
      ? 'Ele mostra só a mesa e o placar, sem cartas de ninguém. Os 4 lugares são dos jogadores.'
      : 'O celular de quem criou a sala mostra a mesa no centro. Sua mão aparece só no seu celular.'
    : '4 celulares: cada um mostra a mesa em cima e a própria mão embaixo.';

  return (
    <Panel tone={table ? 'accent' : 'default'}>
      <View accessible={!isHost} accessibilityLabel={`${title}. ${description}`} style={styles.modeTexts}>
        <Text style={styles.modeKicker}>{table ? '◎  MODO MESA · 5 APARELHOS' : '♠  MODO JOGADOR · 4 APARELHOS'}</Text>
        <Text style={[styles.modeTitle, table && styles.modeTitleTable]}>{title}</Text>
        <Text style={styles.modeText}>{description}</Text>
      </View>
      {isHost ? (
        <Button
          label={table ? 'Trocar: quero jogar' : 'Trocar: este celular será a mesa'}
          variant={table ? 'secondary' : 'gold'}
          size="compact"
          loading={busy}
          disabled={disabled}
          onPress={() => onSwitch(table ? 'player' : 'table')}
        />
      ) : null}
    </Panel>
  );
}

interface SeatBoxProps {
  seat: Seat;
  player: RoomSeat | undefined;
  isMe: boolean;
  hostId: string | undefined;
  disabled: boolean;
  canSit: boolean;
  onSit: () => void;
}

function SeatBox({ seat, player, isMe, hostId, disabled, canSit, onSit }: SeatBoxProps) {
  const team = seat % 2 === 1 ? 'A' : 'B';
  const teamColor = team === 'A' ? colors.teamA : colors.teamB;
  const header = `Lugar ${seat} · Dupla ${team}`;

  if (!player) {
    return (
      <Pressable
        style={({ pressed }) => [styles.seat, styles.seatFree, pressed && styles.seatPressed]}
        onPress={onSit}
        disabled={disabled || !canSit}
        accessibilityRole="button"
        accessibilityLabel={`${header}, livre.${canSit ? ' Toque para sentar aqui' : ' Aguardando jogador'}`}
      >
        <Text style={[styles.seatHeader, { color: teamColor }]}>{header}</Text>
        <Text style={styles.free}>Livre</Text>
        <Text style={styles.freeHint}>{canSit ? 'Toque para sentar' : 'Aguardando jogador'}</Text>
      </Pressable>
    );
  }

  return (
    <View
      style={[styles.seat, { borderLeftColor: teamColor }, isMe && styles.seatMe]}
      accessible
      accessibilityLabel={`${header}, ${player.displayName}${isMe ? ', você' : ''}, ${player.ready ? 'pronto' : 'aguardando'}`}
    >
      <Text style={[styles.seatHeader, { color: teamColor }]}>{header}</Text>
      <Text style={styles.name} numberOfLines={1}>
        {player.displayName}
        {isMe ? ' (você)' : ''}
      </Text>
      {player.userId === hostId ? <Text style={styles.host}>Dono da sala</Text> : null}
      <Text style={[styles.ready, { color: player.ready ? colors.success : colors.textFaint }]}>
        {player.ready ? '✓ Pronto' : '… Aguardando'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  codeBox: { alignItems: 'stretch' },
  codeLabel: { color: colors.textMuted, fontSize: font.tiny, fontWeight: '700', letterSpacing: 2, textAlign: 'center' },
  code: { color: colors.text, fontSize: font.huge + 4, fontWeight: '800', letterSpacing: 10, textAlign: 'center' },
  teams: { fontSize: font.small - 1, color: colors.textMuted, textAlign: 'center', marginBottom: space.sm },
  modeTexts: { gap: space.xs },
  modeKicker: { fontSize: font.tiny, fontWeight: '700', letterSpacing: 1.4, color: colors.textFaint },
  modeTitle: { fontFamily: fonts.display, fontSize: font.large - 2, lineHeight: 28, color: colors.text },
  modeTitleTable: { color: colors.goldSoft },
  modeText: { fontSize: font.small, lineHeight: 21, color: colors.textMuted },
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  seat: {
    flex: 1,
    minHeight: TOUCH_MIN * 2.3,
    backgroundColor: '#0D0E10E6',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderLeftWidth: 4,
    padding: space.sm,
    justifyContent: 'center',
    gap: 2,
  },
  seatFree: {
    borderStyle: 'dashed',
    borderLeftWidth: 1,
    borderColor: colors.metalDark,
    backgroundColor: '#00000040',
    alignItems: 'center',
  },
  seatPressed: { backgroundColor: '#FFFFFF14' },
  seatMe: { borderColor: colors.gold, backgroundColor: '#1E1A12F0' },
  seatHeader: { fontSize: font.small - 2, fontWeight: '800', letterSpacing: 0.3 },
  name: { fontSize: font.large - 2, fontWeight: '800', color: colors.text },
  host: { fontSize: font.small - 2, color: colors.gold },
  ready: { fontSize: font.body - 2, fontWeight: '700' },
  free: { fontSize: font.large - 2, fontWeight: '700', color: colors.textMuted },
  freeHint: { fontSize: font.small - 2, color: colors.textFaint },
  waiting: { fontSize: font.body - 1, color: colors.textMuted, textAlign: 'center' },
});
