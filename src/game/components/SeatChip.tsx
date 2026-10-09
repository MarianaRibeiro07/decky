import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import type { Team } from '../../contracts/types';
import { colors, font, radius, shadow } from '../../ui/theme';
import type { ChipLayout, Rect } from '../geometry';
import { HandPips, PlayerAvatar, TeamTag, TurnTag } from './PlayerIdentity';

interface Props {
  rect: Rect;
  layout: ChipLayout;
  name: string;
  initials: string;
  /** "Nós", "Eles", "Dupla A"... */
  teamText: string;
  team: Team;
  isTurn: boolean;
  /** Cartas ainda na mão do lugar; null para não mostrar (a própria mão já aparece embaixo). */
  cardsLeft: number | null;
  large: boolean;
}

/**
 * Plaquinha de um lugar na mesa: avatar (ficha com as iniciais), nome, dupla e cartas na mão.
 * 'row' (em cima e embaixo): avatar ao lado do nome. 'column' (laterais, estreitas): avatar em cima,
 * nome e dupla centralizados embaixo, para o nome ter a largura toda da etiqueta.
 *
 * Vez: contorno e aro do avatar dourados, nome em dourado claro e o selo "VEZ". O brilho entra uma
 * vez quando a vez chega e fica parado (sem pulsar), para não cansar a leitura nem gastar bateria.
 * Fica sempre dentro do retângulo recebido: a geometria já garante que ele está dentro do feltro.
 */
export function SeatChip({ rect, layout, name, initials, teamText, team, isTurn, cardsLeft, large }: Props) {
  const column = layout === 'column';
  const avatar = column ? (large ? 30 : 22) : Math.round(rect.h - (large ? 16 : 12));
  // Na lateral da mesa dedicada, "DUPLA B" e as cartas não cabem lado a lado: uma linha para cada.
  // Quando a mesa é baixa a geometria entrega uma etiqueta mais curta: aí só a dupla aparece (as
  // cartinhas saem), para nada ser cortado.
  const stacked = column && large && rect.h >= 90;
  const showPips = cardsLeft !== null && (!column || !large || stacked);
  const showTag = isTurn && avatar >= 30;
  const label = `${name}, ${teamText}${isTurn ? ', é a vez' : ''}${
    cardsLeft !== null ? `, ${cardsLeft} ${cardsLeft === 1 ? 'carta' : 'cartas'} na mão` : ''
  }`;

  return (
    <View style={[styles.wrap, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]} accessible accessibilityLabel={label}>
      <View
        style={[
          styles.chip,
          column ? styles.chipColumn : styles.chipRow,
          large && column && styles.chipColumnLarge,
          isTurn && styles.chipTurn,
        ]}
      >
        <View style={styles.avatarBox}>
          <PlayerAvatar initials={initials} team={team} size={avatar} active={isTurn} />
          {showTag ? <TurnTag size={avatar} /> : null}
        </View>
        <View style={[styles.body, column ? styles.bodyColumn : styles.bodyRow]}>
          <Text
            style={[styles.name, large ? styles.nameLarge : styles.nameCompact, column && styles.nameColumn, isTurn && styles.nameTurn]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {name}
          </Text>
          <View style={[styles.meta, column && styles.metaColumn, stacked && styles.metaStacked]}>
            <TeamTag team={team} text={teamText} large={large} />
            {showPips ? <HandPips left={cardsLeft!} large={large && !column} /> : null}
          </View>
        </View>
      </View>
      {/* Brilho da vez: entra uma vez e fica parado; some quando a vez passa. */}
      {isTurn ? (
        <Animated.View pointerEvents="none" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={styles.glow} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute' },
  chip: {
    flex: 1,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: '#0B0B0DE6',
    boxShadow: shadow.card,
    // Nada desenhado fora da plaquinha, mesmo com nome ou rótulo inesperadamente largos.
    overflow: 'hidden',
  },
  chipRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, gap: 7 },
  chipColumn: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 3, gap: 2 },
  chipColumnLarge: { paddingVertical: 6, gap: 4 },
  chipTurn: { backgroundColor: '#1C1810F2', borderColor: colors.gold },
  avatarBox: { alignItems: 'center' },
  body: { minWidth: 0, justifyContent: 'center', gap: 1 },
  // Sem `flex: 0`: no web ele vira altura zero e o nome sumia nas etiquetas laterais.
  bodyRow: { flex: 1 },
  bodyColumn: { alignSelf: 'stretch', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '800' },
  nameLarge: { fontSize: font.body - 1, lineHeight: 22 },
  nameCompact: { fontSize: font.small - 1, lineHeight: 17 },
  nameColumn: { textAlign: 'center', alignSelf: 'stretch' },
  nameTurn: { color: colors.goldSoft },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  metaColumn: { justifyContent: 'center', gap: 4 },
  metaStacked: { flexDirection: 'column', gap: 3 },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: radius.sm + 2,
    borderWidth: 1.5,
    borderColor: colors.gold,
    boxShadow: shadow.turn,
  },
});
