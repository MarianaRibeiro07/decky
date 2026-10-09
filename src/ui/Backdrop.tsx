import { memo, useId } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from './theme';

/**
 * Ambiente do salão: preto profundo, um facho de luz vindo de cima (luminária sobre a mesa)
 * e as bordas mais escuras. Estático e sem textura, para não pesar em nenhuma tela.
 */
export const Backdrop = memo(function Backdrop() {
  const id = `bd${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.base]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={`${id}spot`} cx="50%" cy="0%" rx="80%" ry="55%" fx="50%" fy="0%">
            <Stop offset="0" stopColor="#2C2D32" stopOpacity="1" />
            <Stop offset="0.6" stopColor="#16171A" stopOpacity="0.6" />
            <Stop offset="1" stopColor={colors.bg} stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id={`${id}vignette`} cx="50%" cy="50%" rx="75%" ry="70%">
            <Stop offset="0.6" stopColor="#000000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.7" />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}spot)`} />
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id}vignette)`} />
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  base: { backgroundColor: colors.bg },
});
