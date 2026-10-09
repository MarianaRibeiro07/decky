import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { RoomSeat, Seat } from '../contracts/types';
import { PlayerAvatar, TeamTag } from '../game/components/PlayerIdentity';
import { initials, seatTeam } from '../game/describe';
import { FeltPanel } from '../ui/TableSurface';
import { colors, font, radius, space, TOUCH_MIN } from '../ui/theme';

// Grade em volta da mesa: parceiros ficam na diagonal (1 e 3, 2 e 4).
const GRID: Seat[][] = [
  [1, 2],
  [4, 3],
];

interface Props {
  seats: RoomSeat[];
  /** Lugar de quem olha (null para a mesa central, que não senta). */
  mySeat: Seat | null;
  hostId: string | undefined;
  disabled: boolean;
  /** Quem olha pode sentar (a mesa central só vê os lugares). */
  canSit: boolean;
  onSit: (seat: Seat) => void;
}

/**
 * Lugares da sala sobre a bandeja de feltro. Cada lugar mostra avatar (ficha com as iniciais na cor da
 * dupla), nome, dupla e se está pronto; os marcadores (você, dono da sala) ficam em selos próprios em vez
 * de colados no nome, para um nome longo não esconder "(você)" nas reticências.
 * A bandeja tem cantos de raio fixo e recuo próprio: nenhum lugar encosta no aro, em qualquer tela.
 */
export function SeatPicker({ seats, mySeat, hostId, disabled, canSit, onSit }: Props) {
  const [gridW, setGridW] = useState<number | null>(null);
  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (gridW === null || Math.abs(gridW - w) > 1) setGridW(w);
  }
  // Caixa estreita (celular pequeno): avatar em cima e nome centralizado com a largura toda,
  // como nas etiquetas laterais da mesa. Ao lado, o nome ficava com poucos caracteres por linha.
  const narrow = gridW !== null && (gridW - space.sm) / 2 < 150;

  return (
    <FeltPanel>
      <Text style={styles.teams}>Dupla A: lugares 1 e 3 · Dupla B: lugares 2 e 4</Text>
      <View style={styles.grid} onLayout={onLayout}>
        {GRID.map((row, i) => (
          <View key={i} style={styles.row}>
            {row.map((seat) => (
              <SeatBox
                key={seat}
                seat={seat}
                player={seats.find((s) => s.seat === seat)}
                isMe={mySeat === seat}
                narrow={narrow}
                hostId={hostId}
                disabled={disabled}
                canSit={canSit}
                onSit={() => onSit(seat)}
              />
            ))}
          </View>
        ))}
      </View>
    </FeltPanel>
  );
}

interface SeatBoxProps {
  seat: Seat;
  player: RoomSeat | undefined;
  isMe: boolean;
  narrow: boolean;
  hostId: string | undefined;
  disabled: boolean;
  canSit: boolean;
  onSit: () => void;
}

function SeatBox({ seat, player, isMe, narrow, hostId, disabled, canSit, onSit }: SeatBoxProps) {
  const team = seatTeam(seat);
  const teamColor = team === 'A' ? colors.teamA : colors.teamB;
  const header = `Lugar ${seat}, dupla ${team}`;

  if (!player) {
    return (
      <Pressable
        style={({ pressed }) => [styles.seat, styles.seatFree, pressed && styles.seatPressed]}
        onPress={onSit}
        disabled={disabled || !canSit}
        accessibilityRole="button"
        accessibilityLabel={`${header}, livre.${canSit ? ' Toque para sentar aqui' : ' Aguardando jogador'}`}
      >
        <Text style={[styles.seatHeader, styles.seatHeaderTaken]} numberOfLines={1}>
          LUGAR {seat}
        </Text>
        <View style={[styles.freeMark, { borderColor: teamColor }]}>
          <Text style={[styles.freePlus, { color: teamColor }]}>+</Text>
        </View>
        <Text style={styles.free}>Livre</Text>
        <TeamTag team={team} text={`Dupla ${team}`} large />
        <Text style={styles.freeHint} numberOfLines={1}>
          {canSit ? 'Toque para sentar' : 'Aguardando jogador'}
        </Text>
      </Pressable>
    );
  }

  const isHost = player.userId === hostId;
  return (
    <View
      style={[styles.seat, isMe && styles.seatMe]}
      accessible
      accessibilityLabel={`${header}, ${player.displayName}${isMe ? ', você' : ''}${isHost ? ', dono da sala' : ''}, ${
        player.ready ? 'pronto' : 'aguardando'
      }`}
    >
      <Text style={[styles.seatHeader, styles.seatHeaderTaken]} numberOfLines={1}>
        LUGAR {seat}
      </Text>
      <View style={[styles.identity, narrow && styles.identityNarrow]}>
        <PlayerAvatar initials={initials(player.displayName)} team={team} size={narrow ? 36 : 40} active={false} />
        <View style={[styles.texts, narrow ? styles.textsNarrow : styles.textsWide]}>
          {/* Na sala sobra altura: nome longo quebra em até duas linhas antes das reticências. */}
          <Text style={[styles.name, narrow && styles.center]} numberOfLines={2} ellipsizeMode="tail">
            {player.displayName}
          </Text>
          <TeamTag team={team} text={`Dupla ${team}`} large />
        </View>
      </View>
      <View style={[styles.tags, narrow && styles.tagsNarrow]}>
        {isMe ? <Text style={[styles.tag, styles.tagMe]}>VOCÊ</Text> : null}
        {isHost ? <Text style={[styles.tag, styles.tagHost]}>DONO</Text> : null}
      </View>
      <Text style={[styles.ready, narrow && styles.center, { color: player.ready ? colors.success : colors.textFaint }]}>
        {player.ready ? '✓ Pronto' : '… Aguardando'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  teams: { fontSize: font.small - 1, color: colors.textMuted, textAlign: 'center', marginBottom: space.sm },
  grid: { gap: space.sm },
  row: { flexDirection: 'row', gap: space.sm },
  seat: {
    flex: 1,
    minWidth: 0,
    minHeight: TOUCH_MIN * 2.6,
    backgroundColor: '#0D0E10E6',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  seatFree: {
    borderStyle: 'dashed',
    borderColor: colors.metalDark,
    backgroundColor: '#00000040',
    alignItems: 'center',
  },
  seatPressed: { backgroundColor: '#FFFFFF14' },
  seatMe: { borderColor: colors.gold, backgroundColor: '#1C1810F0' },
  seatHeader: { fontSize: font.small - 3, fontWeight: '800', letterSpacing: 0.3 },
  seatHeaderTaken: { color: colors.textFaint, letterSpacing: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  identityNarrow: { flexDirection: 'column', gap: 4 },
  texts: { minWidth: 0, gap: 1 },
  textsWide: { flex: 1 },
  // Sem `flex: 0`: no web ele zera a altura do bloco.
  textsNarrow: { alignSelf: 'stretch', alignItems: 'center' },
  center: { textAlign: 'center' },
  name: { fontSize: font.body - 1, lineHeight: 21, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', gap: 4, minHeight: 16 },
  tagsNarrow: { justifyContent: 'center' },
  tag: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  tagMe: { color: colors.ink, backgroundColor: colors.gold },
  tagHost: { color: colors.goldSoft, borderWidth: 1, borderColor: colors.goldDeep },
  ready: { fontSize: font.small - 1, fontWeight: '700' },
  freeMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  freePlus: { fontSize: 20, lineHeight: 22, fontWeight: '700' },
  free: { fontSize: font.body - 1, fontWeight: '700', color: colors.textMuted },
  freeHint: { fontSize: font.small - 3, color: colors.textFaint },
});
