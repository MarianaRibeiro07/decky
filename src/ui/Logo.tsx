import { Image } from 'react-native';

export function Logo({ size = 160 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/Decky-Logo.png')}
      style={{ width: size, height: size, alignSelf: 'center' }}
      resizeMode="contain"
      accessibilityLabel="Decky"
    />
  );
}
