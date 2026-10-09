import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeInDown, FadeInLeft, FadeInRight, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { resolveTrick } from '../../../supabase/functions/_shared/engine/strength.ts';
import type { MatchPlayer, PublicGameState, Seat, TableCard } from '../../contracts/types';
import { CARD_BACK, PlayingCard } from '../../ui/PlayingCard';
import { colors, font, radius } from '../../ui/theme';
import type { DealAnimation } from '../useDealAnimation';
import { cardsLeft, seatTeam, tablePositions, teamLabel, type Side } from '../describe';
import { tableGeometry, type Rect, type TableVariant } from '../geometry';
import { DealLayer } from './DealLayer';
import { SeatChip } from './SeatChip';
import { ManilhaBadge, ViraCard } from './ViraCard';

const SIDES: Side[] = ['bottom', 'right', 'top', 'left'];

// A carta entra na mesa vindo do lado de quem a jogou.
const ENTERING = {
  bottom: FadeInDown.duration(280).withInitialValues({ opacity: 0, transform: [{ translateY: 70 }] }),
  top: FadeInUp.duration(280).withInitialValues({ opacity: 0, transform: [{ translateY: -70 }] }),
  left: FadeInLeft.duration(280).withInitialValues({ opacity: 0, transform: [{ translateX: -70 }] }),
  right: FadeInRight.duration(280).withInitialValues({ opacity: 0, transform: [{ translateX: 70 }] }),
} as const;

export interface TableBoardProps {
  state: PublicGameState;
  players: MatchPlayer[];
  /** Assento mostrado embaixo: o do jogador, ou o 1 na mesa central. */
  bottomSeat: Seat;
  /** Assento de quem olha; null na mesa central (visão neutra, sem "Você"). */
  viewerSeat: Seat | null;
  deal: DealAnimation;
  variant: TableVariant;
  /** Fala curta de quem acabou de agir ("TRUCO!", "Aceito!"). */
  bubble: { seat: Seat; text: string } | null;
}

/**
 * A mesa pública: quatro lugares, cartas jogadas na posição de quem jogou, baralho, vira e manilha.
 * É a mesma para o jogador (metade de cima da tela) e para o celular dedicado à mesa; muda só a escala.
 * Não recebe nem desenha mãos: só o que está em PublicGameState.
 */
export function TableBoard(props: TableBoardProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  }

  return (
    <View style={styles.felt} onLayout={onLayout}>
      {size ? <Board {...props} width={size.w} height={size.h} /> : null}
    </View>
  );
}

function Board({ state, players, bottomSeat, viewerSeat, deal, variant, bubble, width, height }: TableBoardProps & { width: number; height: number }) {
  const g = tableGeometry(width, height, variant);
  const large = variant === 'large';
  const positions = tablePositions(bottomSeat);
  const sideOf = (seat: Seat) => SIDES.find((s) => positions[s] === seat)!;
  const viewerTeam = viewerSeat ? seatTeam(viewerSeat) : null;
  const playing = state.status === 'playing';
  const dealing = deal.phase === 'intro' || deal.phase === 'dealing';

  // Entre vazas a mesa limpa; a última vaza fica esmaecida para todos verem o que caiu.
  // Na mão nova, ela só aparece durante a pausa antes de distribuir.
  const showingLast =
    state.tableCards.length === 0 && state.lastTrick !== null && (state.trickResults.length > 0 || deal.phase === 'intro');
  const cards: TableCard[] = showingLast ? state.lastTrick!.cards : state.tableCards;
  const winnerSeat = showingLast && state.lastTrick!.result !== 'tie' ? resolveTrick(state.lastTrick!.cards, state.manilhaRank).leadSeat : null;
  const tableSeats = state.tableCards.map((c) => c.seat);

  const nameOf = (seat: Seat) =>
    seat === viewerSeat ? 'Você' : players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;

  return (
    <>
      <DeckStack rect={g.deck} />
      <ViraCard rect={g.vira} vira={state.vira} manilhaRank={state.manilhaRank} phase={deal.phase} />
      {deal.phase === 'done' && playing ? (
        <ManilhaBadge rect={g.manilha} manilhaRank={state.manilhaRank} large={large} />
      ) : null}

      {SIDES.map((side) => {
        const seat = positions[side];
        const played = cards.find((c) => c.seat === seat);
        const isTurn = playing && !dealing && !state.truco && state.currentTurnSeat === seat;
        return (
          <PlayedSlot
            key={`slot-${side}`}
            rect={g.played[side]}
            side={side}
            played={played}
            dimmed={showingLast}
            winner={winnerSeat === seat}
            waiting={isTurn}
            animationKey={`${state.handNumber}-${state.trickResults.length}`}
          />
        );
      })}

      {SIDES.filter((side) => side !== 'bottom' || g.bottomChipVisible).map((side) => {
        const seat = positions[side];
        const left = cardsLeft(seat, state.trickResults.length, tableSeats, !playing);
        return (
          <SeatChip
            key={`chip-${side}`}
            rect={g.chips[side]}
            name={nameOf(seat)}
            team={seatTeam(seat)}
            teamText={teamLabel(seatTeam(seat), viewerTeam)}
            isTurn={playing && !dealing && state.currentTurnSeat === seat}
            // A própria mão aparece embaixo; durante a distribuição os versos chegam voando.
            cardsLeft={seat === viewerSeat || dealing ? null : left}
            large={large}
          />
        );
      })}

      {bubble ? <Bubble key={`${bubble.seat}-${bubble.text}`} rect={g.chips[sideOf(bubble.seat)]} side={sideOf(bubble.seat)} text={bubble.text} large={large} /> : null}

      {deal.phase === 'dealing' && deal.run ? (
        <DealLayer
          geometry={g}
          dealerSeat={state.dealerSeat}
          sideOf={sideOf}
          run={deal.run}
          bottomTarget={viewerSeat ? 'edge' : 'chip'}
          height={height}
        />
      ) : null}
    </>
  );
}

/** Baralho fechado no centro da mesa, com o verso do Decky. */
function DeckStack({ rect }: { rect: Rect }) {
  return (
    <View style={[styles.abs, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]} accessible accessibilityLabel="Baralho">
      {[4, 2, 0].map((offset) => (
        <Image
          key={offset}
          source={CARD_BACK}
          style={[styles.deckCard, { left: -offset / 2, top: -offset, width: rect.w, height: rect.h }]}
        />
      ))}
    </View>
  );
}

interface SlotProps {
  rect: Rect;
  side: Side;
  played: TableCard | undefined;
  dimmed: boolean;
  winner: boolean;
  /** É a vez deste lugar: o espaço vazio pisca de leve. */
  waiting: boolean;
  animationKey: string;
}

function PlayedSlot({ rect, side, played, dimmed, winner, waiting, animationKey }: SlotProps) {
  const box = { left: rect.x, top: rect.y, width: rect.w, height: rect.h };
  if (!played) {
    return <View style={[styles.abs, styles.emptySlot, waiting && styles.emptySlotTurn, box]} />;
  }
  return (
    <Animated.View
      key={`${animationKey}-${played.card.rank}${played.card.suit}-${dimmed ? 'd' : 'n'}`}
      entering={dimmed ? undefined : ENTERING[side]}
      style={[styles.abs, box]}
    >
      <PlayingCard card={played.card} width={rect.w} dimmed={dimmed && !winner} highlighted={winner} />
      {winner ? (
        <Animated.View entering={ZoomIn.duration(220)} style={styles.winnerTag}>
          <Text style={styles.winnerText}>Venceu</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

function Bubble({ rect, side, text, large }: { rect: Rect; side: Side; text: string; large: boolean }) {
  const h = large ? 40 : 30;
  // Em cima da etiqueta, menos no lugar de cima (embaixo dela, para não sair da mesa).
  const top = side === 'top' ? rect.y + rect.h + 2 : rect.y - h - 2;
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(14)}
      style={[styles.bubble, { left: rect.x, width: rect.w, top, height: h }]}
      accessibilityLiveRegion="polite"
    >
      <Text style={[styles.bubbleText, large && styles.bubbleTextLarge]} numberOfLines={1}>
        {text}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  felt: {
    flex: 1,
    backgroundColor: colors.feltLight,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#0F3322',
    overflow: 'hidden',
  },
  abs: { position: 'absolute' },
  deckCard: { position: 'absolute', borderRadius: radius.sm, borderWidth: 1, borderColor: '#00000066' },
  emptySlot: { borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFFFFF33' },
  emptySlotTurn: { borderColor: colors.gold, borderWidth: 3 },
  winnerTag: {
    position: 'absolute',
    bottom: -8,
    alignSelf: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
  },
  winnerText: { color: colors.ink, fontSize: 11, fontWeight: '900' },
  bubble: {
    position: 'absolute',
    backgroundColor: colors.paper,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleText: { color: colors.red, fontSize: font.body, fontWeight: '900' },
  bubbleTextLarge: { fontSize: font.large },
});

