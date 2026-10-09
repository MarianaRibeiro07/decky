import { memo, useId, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Image, LinearGradient, Path, Pattern, RadialGradient, Stop } from 'react-native-svg';
import { insetBox, superellipsePath, surfaceMetrics, type SurfaceVariant } from './shapes';
import { colors } from './theme';

/** Textura de feltro 128x128 que repete sem emenda (~20 KB). */
const FELT_TEXTURE = require('../../assets/textures/felt.png');
const TEXTURE_SIZE = 128;

interface Props {
  width: number;
  height: number;
  variant: SurfaceVariant;
}

/**
 * Tampo da mesa desenhado em SVG: lateral visível embaixo (espessura), aro de couro preto com costura
 * e reflexo da luminária, trilho metálico, feltro carvão com textura e sombra interna do trilho.
 * É só o desenho: lugares e cartas ficam por cima, em `surfaceMetrics(...).content`.
 * `memo`: só redesenha quando o tamanho muda.
 */
export const TableSurface = memo(function TableSurface({ width, height, variant }: Props) {
  // useId tem caracteres que não valem em url(#...); os ids precisam ser únicos por página na web.
  const id = `ts${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const m = surfaceMetrics(width, height, variant);
  const top = superellipsePath(m.top, m.n);
  const apron = superellipsePath({ ...m.top, y: m.top.y + m.apron }, m.n);
  const rail = superellipsePath(insetBox(m.top, m.rim), m.n);
  const felt = superellipsePath(m.felt, m.n);
  const stitch = superellipsePath(insetBox(m.top, m.rim * 0.28), m.n);
  const cushion = superellipsePath(insetBox(m.top, m.rim * 0.55), m.n);
  const print = superellipsePath(insetBox(m.felt, Math.min(m.felt.w, m.felt.h) * 0.16), m.n);
  const innerShadow = variant === 'table' ? 18 : 10;

  return (
    <Svg width={width} height={height} pointerEvents="none">
      <Defs>
        <LinearGradient id={`${id}apron`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#202124" />
          <Stop offset="1" stopColor="#040405" />
        </LinearGradient>
        <LinearGradient id={`${id}rim`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.leatherHi} />
          <Stop offset="0.35" stopColor="#1B1B1E" />
          <Stop offset="1" stopColor={colors.leather} />
        </LinearGradient>
        <RadialGradient id={`${id}sheen`} cx="50%" cy="0%" rx="60%" ry="45%" fx="50%" fy="0%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${id}rail`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#B9BCC2" />
          <Stop offset="0.5" stopColor="#5E6167" />
          <Stop offset="1" stopColor="#2A2C30" />
        </LinearGradient>
        <RadialGradient id={`${id}felt`} cx="50%" cy="42%" rx="62%" ry="60%" fx="50%" fy="38%">
          <Stop offset="0" stopColor="#3B3D42" />
          <Stop offset="0.55" stopColor={colors.felt} />
          <Stop offset="1" stopColor={colors.feltEdge} />
        </RadialGradient>
        <Pattern id={`${id}tex`} patternUnits="userSpaceOnUse" width={TEXTURE_SIZE} height={TEXTURE_SIZE}>
          <Image href={FELT_TEXTURE} width={TEXTURE_SIZE} height={TEXTURE_SIZE} />
        </Pattern>
        <ClipPath id={`${id}clip`}>
          <Path d={felt} />
        </ClipPath>
      </Defs>

      {/* Lateral do tampo: a espessura que aparece embaixo dá a sensação de objeto apoiado. */}
      <Path d={apron} fill={`url(#${id}apron)`} />
      {/* Aro de couro, com o reflexo da luminária em cima e o volume do acolchoado no meio. */}
      <Path d={top} fill={`url(#${id}rim)`} stroke="#000000" strokeWidth={1} />
      <Path d={top} fill={`url(#${id}sheen)`} />
      <Path d={cushion} fill="none" stroke="#FFFFFF" strokeOpacity={0.045} strokeWidth={m.rim * 0.4} />
      {variant !== 'panel' ? (
        <Path d={stitch} fill="none" stroke="#6A6D73" strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3 3" />
      ) : null}
      {/* Trilho metálico entre o couro e o feltro. */}
      <Path d={rail} fill={`url(#${id}rail)`} />
      {/* Feltro: luz mais forte no centro, textura e a sombra que o trilho projeta para dentro. */}
      <Path d={felt} fill={`url(#${id}felt)`} />
      <Path d={felt} fill={`url(#${id}tex)`} />
      <G clipPath={`url(#${id}clip)`}>
        <Path d={felt} fill="none" stroke="#000000" strokeOpacity={0.5} strokeWidth={innerShadow} />
      </G>
      {variant === 'table' ? (
        <Path d={print} fill="none" stroke={colors.gold} strokeOpacity={0.14} strokeWidth={1} />
      ) : null}
    </Svg>
  );
});

interface FeltPanelProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Bandeja de feltro com aro de couro, para conteúdo em fluxo normal (HUD do jogador, lugares do lobby).
 * Mede o próprio tamanho para desenhar o tampo; o conteúdo fica dentro do feltro.
 */
export function FeltPanel({ children, style }: FeltPanelProps) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (!size || Math.abs(size.w - width) > 1 || Math.abs(size.h - height) > 1) setSize({ w: width, h: height });
  }

  // Medidas do 'panel' são fixas: dá para saber o recuo antes de medir.
  const inset = surfaceMetrics(100, 100, 'panel');
  return (
    <View
      onLayout={onLayout}
      style={[
        styles.panel,
        {
          paddingTop: inset.felt.y + 6,
          paddingLeft: inset.felt.x + 6,
          paddingRight: inset.felt.x + 6,
          paddingBottom: inset.felt.y + inset.apron + 6,
        },
        style,
      ]}
    >
      {size ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <TableSurface width={size.w} height={size.h} variant="panel" />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'relative' },
});
