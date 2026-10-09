import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { colors, font, radius, space } from '../../ui/theme';
import { statusSubline, type StatusText } from '../status';

/**
 * Linha de status: de quem é a vez, pedido de truco pendente e o que acabou de acontecer.
 * Altura fixa (linha principal + uma linha de complemento, mesmo vazia): o banner fica acima ou
 * abaixo da mesa, e se crescesse a mesa encolheria e tudo nela mudaria de lugar.
 */
export function StatusBanner({ status, large }: { status: StatusText | null; large: boolean }) {
  if (!status) return null;
  const truco = status.tone === 'truco';
  const turn = status.tone === 'turn';
  const sub = statusSubline(status);
  // Fonte da linha principal pelo comprimento do texto (nomes longos), para caber numa linha
  // sem depender de `adjustsFontSizeToFit`, que só existe no nativo.
  const len = status.main.length;
  const mainSize = large ? (len <= 22 ? font.title : len <= 32 ? font.large + 1 : font.body) : len <= 30 ? font.body + 1 : font.body - 2;
  return (
    <View style={[styles.box, truco && styles.truco, turn && styles.turn]} accessibilityLiveRegion="polite">
      <Animated.Text
        key={status.main}
        entering={FadeIn.duration(200)}
        style={[
          styles.main,
          { fontSize: mainSize, lineHeight: Math.round((large ? font.title : font.body + 1) * 1.25) },
          turn && styles.mainTurn,
          truco && styles.mainTruco,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {status.main}
      </Animated.Text>
      <Text style={[styles.sub, large && styles.subLarge, truco && styles.subTruco]} numberOfLines={1} ellipsizeMode="tail">
        {sub || ' '}
      </Text>
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
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: space.xs + 2,
    paddingHorizontal: space.sm,
    gap: 1,
  },
  // Pedido de truco: laca vermelha do logo. Sua vez: contorno dourado.
  truco: { backgroundColor: colors.redDeep, borderColor: colors.red },
  turn: { backgroundColor: '#1E1A12', borderColor: colors.gold },
  main: { color: colors.text, fontWeight: '800', textAlign: 'center' },
  mainTurn: { color: colors.goldSoft },
  mainTruco: { color: colors.cream },
  sub: { color: colors.textMuted, fontSize: font.small - 1, lineHeight: 19, textAlign: 'center' },
  subLarge: { fontSize: font.body - 1, lineHeight: 23 },
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
