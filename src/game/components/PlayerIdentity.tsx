import { StyleSheet, Text, View } from 'react-native';
import type { Team } from '../../contracts/types';
import { colors, fonts } from '../../ui/theme';

const teamColor = (team: Team) => (team === 'A' ? colors.teamA : colors.teamB);

interface AvatarProps {
  /** Iniciais (ver `initials`). */
  initials: string;
  team: Team;
  size: number;
  /** É a vez deste lugar: o aro troca a cor da dupla pelo dourado. */
  active: boolean;
}

/**
 * Avatar do lugar no formato de ficha de cassino: aro na cor da dupla, filete escuro e miolo grafite
 * com as iniciais em creme. Na vez, o aro fica dourado. Só Views e texto: atualiza com o estado,
 * sem imagem estática.
 */
export function PlayerAvatar({ initials, team, size, active }: AvatarProps) {
  const ring = Math.max(2, Math.round(size * 0.08));
  const fontSize = Math.round(size * (initials.length > 1 ? 0.36 : 0.44));
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, borderWidth: ring, borderColor: active ? colors.gold : teamColor(team) },
      ]}
    >
      <View style={[styles.avatarCore, { borderRadius: size / 2 }]}>
        <Text
          style={[styles.initials, { fontSize, lineHeight: Math.round(fontSize * 1.2) }, active && styles.initialsActive]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {initials}
        </Text>
      </View>
    </View>
  );
}

/** Selo "VEZ" que fica sobre a base do avatar quando ele tem espaço (avatar de 30 pt ou mais). */
export function TurnTag({ size }: { size: number }) {
  return (
    <View style={[styles.turnTag, { bottom: -5, minWidth: Math.min(size, 34) }]}>
      <Text style={styles.turnTagText} allowFontScaling={false}>
        VEZ
      </Text>
    </View>
  );
}

interface PipsProps {
  /** Cartas ainda na mão (0 a 3). */
  left: number;
  large: boolean;
}

/**
 * Cartas na mão de um lugar como três silhuetas: cheias as que ainda estão na mão, vazadas as já jogadas.
 * Substitui os versos em miniatura, que viravam borrões ilegíveis no tamanho da etiqueta.
 */
export function HandPips({ left, large }: PipsProps) {
  const w = large ? 8 : 7;
  const h = Math.round(w * 1.45);
  return (
    <View style={styles.pips} accessible={false}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={[styles.pip, { width: w, height: h }, i < left ? styles.pipOn : styles.pipOff]} />
      ))}
    </View>
  );
}

/** Rótulo da dupla em versalete, na cor da dupla (informação secundária ao nome). */
export function TeamTag({ team, text, large }: { team: Team; text: string; large: boolean }) {
  return (
    <Text
      style={[styles.team, { color: teamColor(team), fontSize: large ? 11.5 : 10.5, letterSpacing: large ? 0.9 : 0.4 }]}
      numberOfLines={1}
      allowFontScaling={false}
    >
      {text.toLocaleUpperCase('pt-BR')}
    </Text>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: colors.ink, padding: 1.5, boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.6)' },
  avatarCore: { flex: 1, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.display, color: colors.cream, textAlign: 'center', includeFontPadding: false },
  initialsActive: { color: colors.goldSoft },
  turnTag: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.gold,
    alignItems: 'center',
  },
  turnTagText: { color: colors.ink, fontSize: 8.5, fontWeight: '900', letterSpacing: 0.8 },
  pips: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  pip: { borderRadius: 1.5, borderWidth: 1 },
  pipOn: { backgroundColor: '#D9D2C3', borderColor: '#D9D2C3' },
  pipOff: { backgroundColor: 'transparent', borderColor: colors.lineStrong },
  team: { fontWeight: '800', flexShrink: 1 },
});
