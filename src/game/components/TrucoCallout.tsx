import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, fonts } from '../../ui/theme';
import { calloutLayout } from '../calloutLayout';
import { TRUCO_LADDER, trucoTier } from '../cue';
import { trucoName, type Side } from '../describe';
import type { ShownCue } from '../useTableCue';

type CalloutCue = Extract<ShownCue, { kind: 'call' | 'accept' }>;

interface Props {
  cue: CalloutCue;
  /** Nome de quem pediu ou aceitou ("Você" para o próprio jogador). */
  name: string;
  /** Espaço disponível (o palco do centro da mesa ou a faixa do painel do jogador). */
  width: number;
  height: number;
  /** Lado da tela de quem agiu: o pedido entra vindo dali. */
  from: Side | null;
  large: boolean;
}

const OFFSET = 26;
const FROM: Record<Side, { x: number; y: number }> = {
  bottom: { x: 0, y: OFFSET },
  top: { x: 0, y: -OFFSET },
  left: { x: -OFFSET, y: 0 },
  right: { x: OFFSET, y: 0 },
};

/**
 * Aviso de truco no centro da mesa. Uma linguagem só para os quatro degraus (3, 6, 9, 12):
 * plaquinha com o medalhão do valor, quem agiu, o nome do pedido e a escada da aposta.
 *
 * - Pedido (laca vermelha do logo): entra do lado de quem pediu e o medalhão "estoura" com ondas.
 *   A cada degrau o estouro é um pouco maior e há uma onda a mais; a cor e a forma não mudam.
 * - Aceite (selo dourado): desce como um carimbo e um brilho atravessa a plaquinha. A cor diferente
 *   deixa claro que não é um pedido novo, e o medalhão mostra o valor que a mão passou a valer.
 *
 * Tudo roda uma vez, na thread de UI (Reanimated); ao desmontar, as animações param junto. A saída
 * é um fade curto, sem deixar resto na tela. Quem decide quando o aviso existe é `useTableCue`.
 */
export function TrucoCallout({ cue, name, width, height, from, large }: Props) {
  const accept = cue.kind === 'accept';
  const tier = trucoTier(cue.value);
  const kicker = accept ? `${name} aceitou` : cue.raise ? `${name} aumenta` : `${name} pede`;

  // Medidas a partir do espaço disponível: em linha quando há largura; empilhado no palco estreito.
  // Sem espaço para o medalhão, o aceite leva o novo valor no próprio título ("ACEITO! 6").
  let title = accept ? 'ACEITO!' : `${trucoName(cue.value)}!`;
  let lay = calloutLayout(width, height, title, large);
  if (accept && lay.medal === 0) {
    title = `ACEITO! ${cue.value}`;
    lay = calloutLayout(width, height, title, large);
  }
  const { row, medal } = lay;
  const plaqueH = lay.plaque.h;
  const plaqueW = lay.plaque.w;
  // A linha de cima encolhe um pouco antes de cortar com reticências ("VOCÊ AUMENTA" inteiro).
  const kickerFont = lay.kickerSize ? Math.max(9, Math.min(lay.kickerSize, lay.textW / (0.74 * kicker.length))) : 0;

  // Entrada: `enter` move a plaquinha; `pop` estoura o medalhão; `wave` espalha as ondas; `sheen` é o brilho do aceite.
  const enter = useSharedValue(0);
  const pop = useSharedValue(0.4);
  const wave = useSharedValue(0);
  const sheen = useSharedValue(0);

  useEffect(() => {
    // Só withTiming (sem withSpring): com "reduzir movimento" ligado, a mola não avançava no web e o
    // aviso ficava invisível. As curvas com recuo (back) dão o mesmo assentamento.
    if (accept) {
      enter.value = withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) });
      pop.value = withDelay(
        140,
        withSequence(withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2.2)) })),
      );
      wave.value = withDelay(160, withTiming(1, { duration: 620, easing: Easing.out(Easing.quad) }));
      sheen.value = withDelay(280, withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }));
    } else {
      enter.value = withTiming(1, { duration: 320, easing: Easing.out(Easing.back(1.3)) });
      const peak = 1.1 + tier * 0.05;
      pop.value = withDelay(
        90,
        withSequence(
          withTiming(peak, { duration: 200, easing: Easing.out(Easing.back(2)) }),
          withTiming(1, { duration: 260, easing: Easing.out(Easing.back(2.5)) }),
        ),
      );
      wave.value = withDelay(140, withTiming(1, { duration: 640 + tier * 110, easing: Easing.out(Easing.quad) }));
    }
    // Monta uma vez por aviso (a chave do componente é a revisão).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = from ? FROM[from] : { x: 0, y: OFFSET * 0.6 };
  const plaqueStyle = useAnimatedStyle(() => {
    const p = enter.value;
    if (accept) {
      // Carimbo: chega maior e levemente girado, assenta reto.
      return {
        opacity: Math.min(1, p * 2),
        transform: [{ scale: 1.22 - 0.22 * p }, { rotate: `${-5 * (1 - p)}deg` }],
      };
    }
    return {
      opacity: Math.min(1, p * 1.6),
      transform: [{ translateX: start.x * (1 - p) }, { translateY: start.y * (1 - p) }, { scale: 0.9 + 0.1 * p }],
    };
  });
  const medalStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value > 0 && sheen.value < 1 ? 0.22 : 0,
    transform: [{ translateX: -40 + (plaqueW + 80) * sheen.value }, { rotate: '18deg' }],
  }));

  const rings = accept ? 1 : tier + 1;
  const a11y = accept
    ? `${name} aceitou. A mão agora vale ${cue.value}.`
    : `${name} ${cue.raise ? 'aumentou para' : 'pediu'} ${trucoName(cue.value).toLowerCase()}. Valendo ${cue.value} se aceitarem.`;

  return (
    <Animated.View
      exiting={FadeOut.duration(200)}
      pointerEvents="none"
      style={[styles.fill, { width, height }]}
      accessible
      accessibilityLiveRegion="polite"
      accessibilityLabel={a11y}
    >
      <Animated.View
        style={[
          styles.plaque,
          accept ? styles.plaqueAccept : styles.plaqueCall,
          row ? styles.plaqueRow : styles.plaqueStack,
          { height: plaqueH, width: plaqueW, gap: row ? 12 : 3, paddingVertical: lay.pad },
          plaqueStyle,
        ]}
      >
        <View style={[styles.inner, accept ? styles.innerAccept : styles.innerCall]} />
        <Animated.View style={[styles.sheen, { height: plaqueH * 1.6 }, sheenStyle]} />

        {medal > 0 ? (
          <View style={{ width: medal, height: medal, alignItems: 'center', justifyContent: 'center' }}>
            {Array.from({ length: rings }, (_, i) => (
              <Ring key={i} index={i} count={rings} wave={wave} size={medal} color={accept ? colors.gold : colors.red} />
            ))}
            <Animated.View
              style={[
                styles.medal,
                accept ? styles.medalAccept : styles.medalCall,
                { width: medal, height: medal, borderRadius: medal / 2, borderWidth: Math.max(2, medal * 0.05) },
                medalStyle,
              ]}
            >
              <View style={[styles.medalRing, { borderRadius: medal / 2, borderColor: accept ? colors.goldDeep : colors.red }]} />
              {accept && medal >= 44 ? (
                <Text style={[styles.medalCaption, { fontSize: Math.max(8, medal * 0.13) }]} allowFontScaling={false}>
                  VALE
                </Text>
              ) : null}
              <Text
                style={[
                  styles.medalValue,
                  accept ? styles.medalValueAccept : styles.medalValueCall,
                  { fontSize: medal * (cue.value >= 10 ? 0.44 : 0.52), lineHeight: medal * 0.62 },
                ]}
                allowFontScaling={false}
              >
                {cue.value}
              </Text>
            </Animated.View>
          </View>
        ) : null}

        <View style={[styles.texts, !row && styles.textsStack, { maxWidth: lay.textW }]}>
          {lay.kickerSize ? (
            <Text
              style={[styles.kicker, accept ? styles.kickerAccept : styles.kickerCall, { fontSize: kickerFont }, !row && styles.center]}
              numberOfLines={1}
              allowFontScaling={false}
            >
              {kicker.toLocaleUpperCase('pt-BR')}
            </Text>
          ) : null}
          <Text
            style={[
              styles.title,
              accept ? styles.titleAccept : styles.titleCall,
              { fontSize: lay.titleSize, lineHeight: Math.round(lay.titleSize * 1.18) },
              !row && styles.center,
            ]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {title}
          </Text>
          {lay.ladder ? <Ladder value={cue.value} accept={accept} size={lay.ladder} centered={!row} /> : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/** Onda que sai do medalhão uma vez; a de índice maior sai um pouco depois. */
function Ring({
  index,
  count,
  wave,
  size,
  color,
}: {
  index: number;
  count: number;
  wave: SharedValue<number>;
  size: number;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const step = 0.22;
    const t = Math.min(1, Math.max(0, wave.value * (1 + step * (count - 1)) - index * step));
    return { opacity: t > 0 && t < 1 ? (1 - t) * 0.7 : 0, transform: [{ scale: 1 + t * 0.85 }] };
  });
  return <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: color }, style]} />;
}

/** Escada da aposta: um losango por degrau (3, 6, 9, 12), preenchidos até o valor atual. */
function Ladder({ value, accept, size: s, centered }: { value: number; accept: boolean; size: number; centered: boolean }) {
  return (
    <View style={[styles.ladder, centered && { justifyContent: 'center' }]}>
      {TRUCO_LADDER.map((step) => {
        const on = step <= value;
        const current = step === value;
        return (
          <View
            key={step}
            style={[
              styles.diamond,
              { width: current ? s + 2 : s, height: current ? s + 2 : s },
              on ? (accept ? styles.diamondOnAccept : styles.diamondOnCall) : accept ? styles.diamondOffAccept : styles.diamondOffCall,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', left: 0, top: 0, alignItems: 'center', justifyContent: 'center' },
  plaque: {
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
    alignItems: 'center',
    boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.6)',
  },
  plaqueRow: { flexDirection: 'row', paddingHorizontal: 10 },
  plaqueStack: { justifyContent: 'center', paddingHorizontal: 6 },
  plaqueCall: { backgroundColor: colors.redDeep, borderColor: colors.red },
  plaqueAccept: { backgroundColor: '#0D0C0A', borderColor: colors.gold },
  // Filete interno: dá acabamento de placa de cassino.
  inner: { ...StyleSheet.absoluteFill, margin: 3, borderRadius: 11, borderWidth: 1 },
  innerCall: { borderColor: '#FFFFFF1F' },
  innerAccept: { borderColor: '#C9A45C40' },
  sheen: { position: 'absolute', top: '-30%', left: 0, width: 26, backgroundColor: '#FFFFFF' },
  ring: { position: 'absolute', borderWidth: 2 },
  medal: { alignItems: 'center', justifyContent: 'center', borderColor: colors.ink, boxShadow: '0px 3px 6px rgba(0, 0, 0, 0.55)' },
  medalCall: { backgroundColor: colors.cream },
  medalAccept: { backgroundColor: colors.gold },
  medalRing: { ...StyleSheet.absoluteFill, margin: 3, borderWidth: 1.5, borderStyle: 'solid' },
  medalCaption: { color: colors.ink, fontWeight: '900', letterSpacing: 1, marginBottom: -2 },
  medalValue: { fontFamily: fonts.displayHeavy, fontVariant: ['lining-nums'], textAlign: 'center', includeFontPadding: false },
  medalValueCall: { color: colors.red },
  medalValueAccept: { color: colors.ink },
  texts: { flexShrink: 1, gap: 2 },
  textsStack: { alignItems: 'center' },
  center: { textAlign: 'center' },
  kicker: { fontWeight: '800', letterSpacing: 1.1 },
  kickerCall: { color: '#F3C9CF' },
  kickerAccept: { color: '#CDB680' },
  title: { fontFamily: fonts.displayHeavy, letterSpacing: 0.6, includeFontPadding: false },
  titleCall: { color: colors.cream },
  titleAccept: { color: colors.goldSoft },
  ladder: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  diamond: { transform: [{ rotate: '45deg' }], borderRadius: 1.5, borderWidth: 1 },
  diamondOnCall: { backgroundColor: colors.cream, borderColor: colors.cream },
  diamondOffCall: { backgroundColor: 'transparent', borderColor: '#F3C9CF66' },
  diamondOnAccept: { backgroundColor: colors.gold, borderColor: colors.gold },
  diamondOffAccept: { backgroundColor: 'transparent', borderColor: '#C9A45C55' },
});
