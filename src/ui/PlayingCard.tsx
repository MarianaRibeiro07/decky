import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { Card, Suit } from '../contracts/types';
import { cardImage } from './cardImages';
import { colors, radius, shadow } from './theme';

const SUIT_NAMES: Record<Suit, string> = { ouros: 'ouros', espadas: 'espadas', copas: 'copas', paus: 'paus' };
const RANK_NAMES: Record<string, string> = { Q: 'dama', J: 'valete', K: 'rei', A: 'ás' };

/** Nome falado da carta, para leitores de tela e textos ("7 de ouros", "ás de espadas"). */
export function cardLabel(card: Card): string {
  return `${RANK_NAMES[card.rank] ?? card.rank} de ${SUIT_NAMES[card.suit]}`;
}

const RATIO = 726 / 500;
/**
 * Verso das cartas do Decky (baralho fechado, cartas dos outros jogadores e distribuição).
 * É `assets/Fundo-Carta-Vermelho.png` reduzido para 400×600: o original (1024×1536, 2,2 MB) era
 * decodificado em até ~25 imagens ao mesmo tempo durante a distribuição e travava os aparelhos.
 */
export const CARD_BACK = require('../../assets/cards/back.png');
const BACK = CARD_BACK;

interface Props {
  card?: Card;
  /** Largura em pontos; a altura segue a proporção da carta. */
  width: number;
  faceDown?: boolean;
  highlighted?: boolean;
  /** Carta escolhida na mão, aguardando confirmação. */
  selected?: boolean;
  dimmed?: boolean;
  /** Sombra de apoio: 'table' para carta pousada no feltro, 'lifted' para a carta erguida na mão. */
  elevation?: 'none' | 'table' | 'lifted';
  onPress?: () => void;
  disabled?: boolean;
  hint?: string;
}

export function PlayingCard({ card, width, faceDown, highlighted, selected, dimmed, elevation = 'none', onPress, disabled, hint }: Props) {
  const height = width * RATIO;
  const face = !faceDown && card ? card : null;
  // A sombra fica num invólucro: no quadro de dentro o `overflow: hidden` (cantos da imagem) a cortaria.
  const image = (
    <View
      style={[
        styles.shadowBox,
        elevation !== 'none' && { boxShadow: elevation === 'lifted' ? shadow.cardLifted : shadow.card },
        dimmed && styles.dimmed,
      ]}
    >
      <View style={[styles.frame, { width, height }, highlighted && styles.highlighted, selected && styles.selected]}>
        <Image
          source={face ? cardImage(face) : BACK}
          style={styles.image}
          resizeMode={face ? 'contain' : 'cover'}
          accessibilityIgnoresInvertColors
        />
      </View>
    </View>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={face ? cardLabel(face) : 'carta virada'}>
        {image}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={face ? cardLabel(face) : 'carta virada'}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled, selected: !!selected }}
      style={({ pressed }) => [pressed && !disabled && styles.pressed]}
    >
      {image}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadowBox: { borderRadius: radius.sm },
  frame: {
    borderRadius: radius.sm,
    // Branco: é a cor do papel das imagens das cartas (os cantos delas são transparentes).
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000055',
  },
  image: { width: '100%', height: '100%' },
  highlighted: { borderWidth: 3, borderColor: colors.gold },
  selected: { borderWidth: 3, borderColor: colors.red },
  dimmed: { opacity: 0.5 },
  pressed: { transform: [{ translateY: -10 }] },
});
