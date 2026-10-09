import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Card, Rank } from '../../contracts/types';
import { cardLabel, PlayingCard } from '../../ui/PlayingCard';
import { colors, font, radius } from '../../ui/theme';
import { DEAL_TIMING, type DealPhase } from '../deal';
import type { Rect } from '../geometry';

const RANK_NAMES: Partial<Record<Rank, string>> = { Q: 'Dama', J: 'Valete', K: 'Rei', A: 'Ás' };

export const rankName = (rank: Rank) => RANK_NAMES[rank] ?? rank;

interface Props {
  rect: Rect;
  vira: Card;
  manilhaRank: Rank;
  phase: DealPhase;
}

/**
 * A vira, que vira de face na etapa 'reveal' da distribuição.
 * Fora do 'reveal' a carta é estática (verso ou face, conforme a fase). O giro só existe enquanto
 * dura a etapa e começa sempre do verso: a vira nova nunca aparece aberta por um quadro antes da hora.
 */
export function ViraCard({ rect, vira, manilhaRank, phase }: Props) {
  const faceUp = phase === 'reveal' || phase === 'done';
  const manilhaName = rankName(manilhaRank);

  return (
    <View
      style={[styles.wrap, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      accessible
      accessibilityLabel={faceUp ? `Vira: ${cardLabel(vira)}. Manilha: ${manilhaName}` : 'Vira ainda fechada'}
    >
      {phase === 'reveal' ? (
        <ViraFlip key={`${vira.rank}_${vira.suit}`} vira={vira} width={rect.w} />
      ) : (
        <PlayingCard card={vira} faceDown={!faceUp} width={rect.w} />
      )}
    </View>
  );
}

/** Giro de verso para face. Montado só durante o 'reveal'; ao desmontar, o Reanimated cancela a animação. */
function ViraFlip({ vira, width }: { vira: Card; width: number }) {
  // 0 = verso, 1 = face.
  const flip = useSharedValue(0);

  useEffect(() => {
    flip.value = withTiming(1, { duration: DEAL_TIMING.reveal * 0.8, easing: Easing.inOut(Easing.cubic) });
  }, [flip]);

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ scaleX: Math.abs(Math.cos(flip.value * Math.PI)) }],
  }));
  const faceStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ scaleX: Math.abs(Math.cos(flip.value * Math.PI)) }],
  }));

  return (
    <>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>
        <PlayingCard faceDown width={width} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, faceStyle]}>
        <PlayingCard card={vira} width={width} />
      </Animated.View>
    </>
  );
}

interface ManilhaProps {
  rect: Rect;
  manilhaRank: Rank;
  large: boolean;
}

/** Selo da manilha, sobre o baralho e ao lado da vira. Aparece depois que a vira é revelada. */
export function ManilhaBadge({ rect, manilhaRank, large }: ManilhaProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(350)}
      style={[styles.manilha, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}
      accessible
      accessibilityLabel={`Manilha: ${rankName(manilhaRank)}`}
    >
      <Text style={[styles.manilhaCaption, large && styles.manilhaCaptionLarge]} numberOfLines={1}>
        MANILHA
      </Text>
      <Text style={[styles.manilhaRank, large && styles.manilhaRankLarge]} numberOfLines={1} adjustsFontSizeToFit>
        ★ {rankName(manilhaRank)}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  manilha: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.ink,
  },
  manilhaCaption: { color: colors.ink, fontSize: 9, fontWeight: '900' },
  manilhaCaptionLarge: { fontSize: 11 },
  manilhaRank: { color: colors.ink, fontSize: font.small, fontWeight: '900', lineHeight: font.small + 2 },
  manilhaRankLarge: { fontSize: font.large, lineHeight: font.large + 2 },
});
