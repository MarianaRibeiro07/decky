import { Image, Pressable, StyleSheet, View } from 'react-native';
import type { Card, Suit } from '../contracts/types';
import { cardImage } from './cardImages';
import { colors, radius } from './theme';

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
  onPress?: () => void;
  disabled?: boolean;
  hint?: string;
}

export function PlayingCard({ card, width, faceDown, highlighted, selected, dimmed, onPress, disabled, hint }: Props) {
  const height = width * RATIO;
  const face = !faceDown && card ? card : null;
  const image = (
    <View
      style={[
        styles.frame,
        { width, height },
        highlighted && styles.highlighted,
        selected && styles.selected,
        dimmed && styles.dimmed,
      ]}
    >
      <Image
        source={face ? cardImage(face) : BACK}
        style={styles.image}
        resizeMode={face ? 'contain' : 'cover'}
        accessibilityIgnoresInvertColors
      />
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
  frame: {
    borderRadius: radius.sm,
    backgroundColor: colors.paper,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#00000033',
  },
  image: { width: '100%', height: '100%' },
  highlighted: { borderWidth: 4, borderColor: colors.gold },
  selected: { borderWidth: 4, borderColor: colors.red },
  dimmed: { opacity: 0.55 },
  pressed: { transform: [{ translateY: -10 }] },
});
