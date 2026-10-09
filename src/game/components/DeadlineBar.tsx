import { memo, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { ActionDeadline } from '../../contracts/types';
import { useRerenderAt } from '../../lib/useRerenderAt';
import { colors, radius } from '../../ui/theme';
import { ACTION_TIMEOUT_MS, hasStarted, remainingMs, secondsLeft, tickMoments, URGENT_MS } from '../deadline';

const NO_MOMENTS: number[] = [];

interface Props {
  deadline: ActionDeadline | null | undefined;
  /** Relógio do servidor menos o do aparelho (`useServerClock`). */
  offset: number;
  /** 'strip': barra com os segundos (painel da mão). 'thin': só o filete (etiqueta do lugar na mesa). */
  variant: 'strip' | 'thin';
  /** O que o prazo é, para o leitor de tela ("Sua vez", "Responder ao truco"). */
  label?: string;
}

/**
 * Prazo da decisão em aberto. É o único componente que redesenha com o tempo: o número muda uma vez
 * por segundo (`useRerenderAt`) e a barra desce com um único `withTiming` na thread de UI até o fim.
 * Sem prazo (ou antes de começar), ocupa a mesma altura vazia: nada em volta muda de lugar.
 * Só mostra: quem decide o que acontece no fim é o servidor.
 */
export const DeadlineBar = memo(function DeadlineBar({ deadline, offset, variant, label }: Props) {
  useRerenderAt(deadline ? tickMoments(deadline, offset) : NO_MOMENTS);
  const progress = useSharedValue(1);
  const now = Date.now();
  const started = !!deadline && hasStarted(deadline, now, offset);
  const remaining = deadline && started ? remainingMs(deadline, now, offset) : 0;
  const urgent = started && remaining <= URGENT_MS;
  const at = deadline?.at ?? null;

  useEffect(() => {
    if (at === null || !started || !deadline) {
      cancelAnimation(progress);
      progress.value = 1;
      return;
    }
    const left = remainingMs(deadline, Date.now(), offset);
    progress.value = left / ACTION_TIMEOUT_MS;
    // A barra é informação (o tempo que falta), não enfeite: segue descendo mesmo com "reduzir movimento".
    progress.value = withTiming(0, { duration: left, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    return () => cancelAnimation(progress);
    // Um prazo novo (outro `at`), o início da contagem ou outra diferença de relógio reiniciam a barra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at, started, offset, progress]);

  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

  if (!deadline || !started) return <View style={variant === 'strip' ? styles.strip : styles.thin} />;

  const seconds = secondsLeft(remaining);
  const bar = (
    <View style={[styles.track, variant === 'thin' && styles.trackThin]}>
      <Animated.View style={[styles.fill, urgent && styles.fillUrgent, fill]} />
    </View>
  );
  if (variant === 'thin') return <View style={styles.thin}>{bar}</View>;

  return (
    <View
      style={styles.strip}
      accessible
      accessibilityLabel={`${label ?? 'Tempo'}: ${seconds} ${seconds === 1 ? 'segundo' : 'segundos'}`}
      accessibilityLiveRegion={urgent ? 'polite' : 'none'}
    >
      {bar}
      <Text style={[styles.seconds, urgent && styles.secondsUrgent]} allowFontScaling={false}>
        {seconds}s
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  strip: { flex: 1, height: 22, flexDirection: 'row', alignItems: 'center', gap: 8 },
  thin: { height: 3, alignSelf: 'stretch' },
  track: {
    flex: 1,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSunken,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  trackThin: { height: 3, borderWidth: 0, borderRadius: 2, backgroundColor: '#00000066' },
  // A barra encolhe a partir da esquerda: só escala anima, sem refazer o layout a cada quadro.
  fill: { flex: 1, backgroundColor: colors.gold, transformOrigin: 'left' },
  fillUrgent: { backgroundColor: colors.red },
  seconds: { minWidth: 30, textAlign: 'right', color: colors.goldSoft, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
  secondsUrgent: { color: colors.redText },
});
