import { useId } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';

/**
 * Logo oficial do Decky, sem alteração. O contorno do logo é quase preto, então sobre o fundo escuro
 * ele ganha um halo de luz atrás (como uma placa iluminada) para a silhueta continuar legível.
 */
export function Logo({ size = 160, halo = true }: { size?: number; halo?: boolean }) {
  const id = `lg${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const glow = size * 1.5;
  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      {halo ? (
        <View pointerEvents="none" style={[styles.halo, { width: glow, height: glow, left: (size - glow) / 2, top: (size - glow) / 2 }]}>
          <Svg width={glow} height={glow}>
            <Defs>
              <RadialGradient id={id} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#3A3B41" stopOpacity="0.95" />
                <Stop offset="0.55" stopColor="#24252A" stopOpacity="0.55" />
                <Stop offset="1" stopColor="#0A0A0B" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx={glow / 2} cy={glow / 2} rx={glow / 2} ry={glow / 2.3} fill={`url(#${id})`} />
          </Svg>
        </View>
      ) : null}
      <Image
        source={require('../../assets/Decky-Logo.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel="Decky"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center' },
  halo: { position: 'absolute' },
});
