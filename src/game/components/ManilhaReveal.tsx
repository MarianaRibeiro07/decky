import { memo, useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from 'react-native-svg';
import { starPath } from '../../ui/icons';
import { CARD_RATIO, cardRadius } from '../../ui/PlayingCard';
import { colors } from '../../ui/theme';
import { MANILHA_REVEAL } from '../manilha';

interface Props {
  /** Largura da carta revelada; o efeito se ajusta a ela. */
  cardWidth: number;
  /** Progresso inicial (0 a 1). Diferente de 0 quando a tela é remontada no meio da revelação. */
  from: number;
}

const STAR = starPath(50, 52, 46, 19);
// Brilho em cruz atrás da estrela: quatro raios longos e finos.
const GLINT = starPath(50, 50, 50, 4, 4);
const SPARKLE = starPath(10, 10, 10, 2.2, 4);
// Faíscas em volta da estrela, em fração da carta a partir do centro (dx, dy, tamanho).
const SPARKLES: [number, number, number][] = [
  [-0.36, -0.3, 0.16],
  [0.38, -0.18, 0.12],
  [-0.3, 0.32, 0.11],
  [0.32, 0.36, 0.15],
];

/**
 * Revelação da manilha recebida, como a de um item lendário: a carta acende em dourado, uma estrela
 * surge no centro, brilha forte por um instante com uma onda de luz e se dissolve, deixando só o
 * destaque permanente (contorno, halo e selo, desenhados pelo PlayingCard).
 *
 * Fica sobre a carta sem receber toque (a carta segue selecionável e jogável) e vai um pouco além
 * das bordas, para o brilho se espalhar. Não decide nada: quando montar vem de `manilhaReveals`.
 * Com "reduzir movimento" ligado no sistema, não anima: fica só o destaque permanente.
 */
export const ManilhaReveal = memo(function ManilhaReveal({ cardWidth, from }: Props) {
  const reduceMotion = useReducedMotion();
  // Só o valor da montagem conta: um render novo não reinicia nem pula a animação.
  const [start] = useState(() => Math.min(1, Math.max(0, from)));
  const t = useSharedValue(start);

  useEffect(() => {
    if (reduceMotion) return;
    // A preferência do sistema já foi tratada acima (sem efeito nenhum); aqui a animação roda inteira.
    t.value = withTiming(1, { duration: (1 - start) * MANILHA_REVEAL.duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
    return () => cancelAnimation(t);
  }, [reduceMotion, start, t]);

  if (reduceMotion) return null;

  const w = cardWidth;
  const h = w * CARD_RATIO;
  const pad = w * 0.42;
  const box = { w: w + pad * 2, h: h + pad * 2 };
  const centered = (size: number) => ({ left: (box.w - size) / 2, top: (box.h - size) / 2, width: size, height: size });

  return (
    <View pointerEvents="none" style={[styles.box, { left: -pad, top: -pad, width: box.w, height: box.h }]}>
      <Halo t={t} width={box.w} height={box.h} />
      <Edge t={t} style={{ left: pad, top: pad, width: w, height: h, borderRadius: cardRadius(w) }} />
      <Ring t={t} style={[centered(w * 1.25), { borderRadius: w }]} />
      <Glint t={t} style={centered(w * 1.3)} />
      <Sparkles t={t} cardWidth={w} box={box} />
      <Star t={t} style={centered(w * 0.58)} />
    </View>
  );
});

type Layer = { t: SharedValue<number> };

const clamp = Extrapolation.CLAMP;

/** Luz dourada que nasce do centro, cresce até o pico e se dissipa para fora. */
function Halo({ t, width, height }: Layer & { width: number; height: number }) {
  const id = `halo${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.22, 0.42, 0.52, 0.95], [0, 0.45, 0.6, 1, 0], clamp),
    transform: [{ scale: interpolate(t.value, [0, 0.52, 1], [0.7, 1.08, 1.15], clamp) }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor={colors.goldLight} stopOpacity="0.85" />
            <Stop offset="0.35" stopColor={colors.goldBright} stopOpacity="0.5" />
            <Stop offset="0.7" stopColor={colors.gold} stopOpacity="0.14" />
            <Stop offset="1" stopColor={colors.gold} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={width / 2} cy={height / 2} rx={width / 2} ry={height / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** A própria carta acende: contorno de ouro claro com brilho e um véu dourado leve por cima. */
function Edge({ t, style: frame }: Layer & { style: object }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0, 0.2, 0.55, 1], [0, 1, 0.95, 0], clamp),
  }));
  return <Animated.View style={[styles.edge, frame, style]} />;
}

/** Onda de luz que se expande no pico e some. */
function Ring({ t, style: frame }: Layer & { style: object }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.38, 0.43, 0.78], [0, 0.9, 0], clamp),
    transform: [{ scale: interpolate(t.value, [0.38, 0.78], [0.3, 1.6], clamp) }],
  }));
  return <Animated.View style={[styles.ring, frame, style]} />;
}

/** Brilho em cruz atrás da estrela, girando devagar durante o pico. */
function Glint({ t, style: frame }: Layer & { style: object }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.34, 0.46, 0.74], [0, 0.95, 0], clamp),
    transform: [
      { rotate: `${interpolate(t.value, [0.34, 0.8], [0, 45], clamp)}deg` },
      { scale: interpolate(t.value, [0.34, 0.5], [0.35, 1], clamp) },
    ],
  }));
  return (
    <Animated.View style={[styles.abs, frame, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Path d={GLINT} fill={colors.goldLight} />
      </Svg>
    </Animated.View>
  );
}

/** Quatro faíscas pequenas em volta da estrela, só no pico. */
function Sparkles({ t, cardWidth, box }: Layer & { cardWidth: number; box: { w: number; h: number } }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.42, 0.5, 0.62, 0.8], [0, 1, 0.75, 0], clamp),
    transform: [{ scale: interpolate(t.value, [0.42, 0.56], [0.3, 1], clamp) }],
  }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {SPARKLES.map(([dx, dy, s], i) => {
        const size = cardWidth * s;
        return (
          <Svg
            key={i}
            width={size}
            height={size}
            viewBox="0 0 20 20"
            style={[styles.abs, { left: box.w / 2 + dx * cardWidth - size / 2, top: box.h / 2 + dy * cardWidth * CARD_RATIO - size / 2 }]}
          >
            <Path d={SPARKLE} fill={colors.goldLight} />
          </Svg>
        );
      })}
    </Animated.View>
  );
}

/** A estrela dourada: surge girando, passa um pouco do tamanho, assenta, brilha e se dissolve. */
function Star({ t, style: frame }: Layer & { style: object }) {
  const id = `star${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(t.value, [0.15, 0.3, 0.62, 0.92], [0, 1, 1, 0], clamp),
    transform: [
      { rotate: `${interpolate(t.value, [0.15, 0.42], [-35, 0], clamp)}deg` },
      { scale: interpolate(t.value, [0.15, 0.38, 0.46, 0.62, 0.95], [0.2, 1.18, 1, 1, 0.82], clamp) },
    ],
  }));
  return (
    <Animated.View style={[styles.abs, frame, style]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id={id} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor="#FFFBE8" />
            <Stop offset="0.35" stopColor={colors.goldLight} />
            <Stop offset="0.7" stopColor={colors.goldBright} />
            <Stop offset="1" stopColor="#B8862F" />
          </LinearGradient>
        </Defs>
        <Path d={STAR} fill={`url(#${id})`} stroke={colors.goldDeep} strokeWidth="2.5" strokeLinejoin="round" />
        {/* Reflexo na ponta de cima: dá volume à estrela. */}
        <Path d="M50 14 L57 38 L50 34 Z" fill="#FFFFFF" fillOpacity="0.7" />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  abs: { position: 'absolute' },
  edge: {
    position: 'absolute',
    borderWidth: 2.5,
    borderColor: colors.goldLight,
    backgroundColor: 'rgba(255, 225, 150, 0.2)',
    boxShadow: '0px 0px 18px 4px rgba(255, 214, 120, 0.85)',
  },
  ring: { position: 'absolute', borderWidth: 2, borderColor: colors.goldLight },
});
