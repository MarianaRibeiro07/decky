import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, font, radius, space } from '../../ui/theme';
import { statusSubline, type StatusText } from '../status';

// Altura das linhas do banner. A caixa tem sempre a altura das duas linhas (ver `bannerHeight`).
const LINES = {
  compact: { main: Math.round((font.body + 1) * 1.25), sub: 19 },
  large: { main: Math.round(font.title * 1.25), sub: 23 },
};
const PAD_V = space.xs + 2;
const GAP = 1;
const BORDER = 1;

/** Altura fixa do banner: linha principal + linha de complemento + recuos e borda. */
export function bannerHeight(large: boolean): number {
  const l = large ? LINES.large : LINES.compact;
  return l.main + GAP + l.sub + 2 * PAD_V + 2 * BORDER;
}

/**
 * Linha de status: de quem é a vez, pedido de truco pendente e o que acabou de acontecer.
 * Altura fixa (cabem a linha principal e uma de complemento): o banner fica acima ou abaixo da mesa,
 * e se crescesse a mesa encolheria e tudo nela mudaria de lugar.
 *
 * Sem complemento, a linha principal fica centralizada na altura. Antes a altura era garantida por
 * uma segunda linha com um espaço (' '): no Android e no iOS ela ocupava a linha inteira e empurrava
 * o texto para cima da metade do banner; no web o espaço sumia e o banner encolhia.
 */
export function StatusBanner({ status, large }: { status: StatusText | null; large: boolean }) {
  if (!status) return null;
  const truco = status.tone === 'truco';
  const turn = status.tone === 'turn' || status.tone === 'team';
  const sub = statusSubline(status);
  const lines = large ? LINES.large : LINES.compact;
  // Fonte da linha principal pelo comprimento do texto (nomes longos), para caber numa linha
  // sem depender de `adjustsFontSizeToFit`, que só existe no nativo.
  const len = status.main.length;
  const mainSize = large ? (len <= 22 ? font.title : len <= 32 ? font.large + 1 : font.body) : len <= 30 ? font.body + 1 : font.body - 2;
  return (
    <View style={[styles.box, { height: bannerHeight(large) }, truco && styles.truco, turn && styles.turn]} accessibilityLiveRegion="polite">
      <Animated.Text
        key={status.main}
        entering={FadeIn.duration(200)}
        style={[
          styles.main,
          { fontSize: mainSize, lineHeight: lines.main },
          turn && styles.mainTurn,
          truco && styles.mainTruco,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {status.main}
      </Animated.Text>
      {sub ? (
        <Text style={[styles.sub, large && styles.subLarge, truco && styles.subTruco]} numberOfLines={1} ellipsizeMode="tail">
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

/** Aviso de conexão: some sozinho quando a leitura volta a funcionar. */
export function ConnectionBanner({ status }: { status: 'connecting' | 'online' | 'reconnecting' }) {
  if (status !== 'reconnecting') return null;
  return (
    <View style={styles.connection} accessibilityRole="alert" accessibilityLiveRegion="assertive">
      <Text style={styles.connectionText}>⟳ Sem conexão. Tentando reconectar; suas cartas estão salvas.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: colors.surface,
    borderWidth: BORDER,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: PAD_V,
    paddingHorizontal: space.sm,
    gap: GAP,
    justifyContent: 'center',
  },
  // Pedido de truco: laca vermelha do logo. Sua vez: contorno dourado.
  truco: { backgroundColor: colors.redDeep, borderColor: colors.red },
  turn: { backgroundColor: '#1E1A12', borderColor: colors.gold },
  main: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  mainTurn: { color: colors.goldSoft },
  mainTruco: { color: colors.cream },
  sub: { color: colors.textMuted, fontSize: font.small - 1, lineHeight: LINES.compact.sub, textAlign: 'center' },
  subLarge: { fontSize: font.body - 1, lineHeight: LINES.large.sub },
  subTruco: { color: '#F3C9CF' },
  connection: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: '#7A1427',
    borderRadius: radius.sm,
    paddingVertical: 4,
    paddingHorizontal: space.sm,
  },
  connectionText: { color: colors.redText, fontSize: font.small - 1, fontWeight: '700', textAlign: 'center' },
});
