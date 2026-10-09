import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import type { MatchPlayer, PublicGameState, Seat } from '../../contracts/types';
import { CARD_BACK } from '../../ui/PlayingCard';
import { FeltPanel } from '../../ui/TableSurface';
import { colors, font, radius, shadow, space } from '../../ui/theme';
import { seatSummaries, seatTeam, teamLabel, type SeatSummary } from '../describe';
import type { DealAnimation } from '../useDealAnimation';
import { ManilhaBadge, ViraCard } from './ViraCard';

interface Props {
  state: PublicGameState;
  players: MatchPlayer[];
  mySeat: Seat;
  deal: DealAnimation;
  bubble: { seat: Seat; text: string } | null;
}

const VIRA_W = 58;
const VIRA_H = VIRA_W * (726 / 500);
const BADGE = { w: 96, h: 46 };

/**
 * O essencial público para o jogador quando há celular dedicado à mesa (modo 'table').
 * A mesa completa (cartas jogadas na posição de cada um, baralho, distribuição) fica só no aparelho
 * da mesa; aqui ficam vira e manilha (para reconhecer as próprias manilhas), quem joga agora, quem já
 * jogou nesta vaza e as falas de truco. Nenhuma carta jogada ou de mão alheia é desenhada.
 */
export const PlayerHud = memo(function PlayerHud({ state, players, mySeat, deal, bubble }: Props) {
  const dealing = deal.phase === 'intro' || deal.phase === 'dealing';
  const nameOf = (seat: Seat) =>
    seat === mySeat ? 'Você' : players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;
  const seats = seatSummaries(state, mySeat, nameOf, dealing);
  const myTeam = seatTeam(mySeat);
  // Primeira linha: a nossa dupla (eu e o parceiro); segunda: a outra dupla, na ordem em que jogam.
  const rows = [
    [seats[0], seats[2]],
    [seats[1], seats[3]],
  ];

  return (
    <FeltPanel style={styles.wrap}>
      <View style={styles.viraRow}>
        <View style={{ width: VIRA_W, height: VIRA_H }}>
          <ViraCard rect={{ x: 0, y: 0, w: VIRA_W, h: VIRA_H }} vira={state.vira} manilhaRank={state.manilhaRank} phase={deal.phase} />
        </View>
        <View style={{ width: BADGE.w, height: BADGE.h }}>
          {deal.phase === 'done' && state.status === 'playing' ? (
            <ManilhaBadge rect={{ x: 0, y: 0, ...BADGE }} manilhaRank={state.manilhaRank} large />
          ) : null}
        </View>
        <Text style={styles.hint}>As cartas jogadas aparecem na mesa central.</Text>
      </View>

      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((s) => (
            <SeatPill
              key={s.seat}
              seat={s}
              teamText={teamLabel(s.team, myTeam)}
              bubble={bubble && bubble.seat === s.seat ? bubble.text : null}
              showCards={s.seat !== mySeat && !dealing}
            />
          ))}
        </View>
      ))}
    </FeltPanel>
  );
});

function SeatPill({ seat, teamText, bubble, showCards }: { seat: SeatSummary; teamText: string; bubble: string | null; showCards: boolean }) {
  const label = `${seat.name}, ${teamText}${seat.isTurn ? ', é a vez' : ''}${seat.played ? ', já jogou nesta vaza' : ''}${
    showCards ? `, ${seat.cardsLeft} ${seat.cardsLeft === 1 ? 'carta' : 'cartas'}` : ''
  }`;
  return (
    <View style={[styles.pill, seat.isTurn && styles.pillTurn]} accessible accessibilityLabel={label}>
      <View style={[styles.teamBar, { backgroundColor: seat.team === 'A' ? colors.teamA : colors.teamB }]} />
      <View style={styles.body}>
        <Text style={[styles.name, seat.isTurn && styles.dark]} numberOfLines={1}>
          {seat.isTurn ? '▶ ' : ''}
          {seat.name}
        </Text>
        <View style={styles.sub}>
          <Text style={[styles.team, seat.isTurn && styles.dark]} numberOfLines={1}>
            {teamText}
            {seat.played ? ' · ✓ jogou' : ''}
          </Text>
          {showCards && seat.cardsLeft > 0 ? (
            <View style={styles.backs}>
              {Array.from({ length: seat.cardsLeft }, (_, i) => (
                <Image key={i} source={CARD_BACK} style={styles.back} />
              ))}
            </View>
          ) : null}
        </View>
      </View>
      {bubble ? (
        <Animated.View key={bubble} entering={ZoomIn.springify().damping(14)} style={styles.bubble} accessibilityLiveRegion="polite">
          <Text style={styles.bubbleText} numberOfLines={1}>
            {bubble}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: space.sm },
  viraRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  hint: { flex: 1, color: colors.textMuted, fontSize: font.small - 2, fontWeight: '600' },
  row: { flexDirection: 'row', gap: space.sm },
  pill: {
    flex: 1,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: '#0B0B0DE0',
    overflow: 'hidden',
  },
  pillTurn: { backgroundColor: '#1E1A12F2', borderColor: colors.gold },
  teamBar: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, paddingHorizontal: 8, paddingVertical: 4 },
  name: { color: colors.text, fontSize: font.body - 1, fontWeight: '800' },
  dark: { color: colors.goldSoft },
  sub: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  team: { color: colors.textMuted, fontSize: font.small - 2, fontWeight: '600', flexShrink: 1 },
  backs: { flexDirection: 'row', gap: 2 },
  back: { width: 10, height: 14.5, borderRadius: 2 },
  // Balão no estilo do logo: creme, contorno quase preto e vermelho.
  bubble: {
    backgroundColor: colors.cream,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.ink,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 6,
    boxShadow: shadow.card,
  },
  bubbleText: { color: colors.red, fontSize: font.small, fontWeight: '900' },
});
