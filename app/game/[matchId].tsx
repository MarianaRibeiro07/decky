import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getLegalActions } from '../../supabase/functions/_shared/engine/index.ts';
import { useAuth } from '../../src/auth/AuthProvider';
import type { Card, GameAction, PublicGameState, Seat, Team } from '../../src/contracts/types';
import { submitAction } from '../../src/game/api';
import { cardsLeft, describeHand, describeTrick, tablePositions, teamLabel, trucoName } from '../../src/game/describe';
import { useMatch } from '../../src/game/useMatch';
import { errorMessage } from '../../src/lib/errors';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { cardLabel, PlayingCard } from '../../src/ui/PlayingCard';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space } from '../../src/ui/theme';

export default function Game() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { userId } = useAuth();
  const { match, hand, players, loaded, notFound, connection, refresh } = useMatch(matchId);
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!loaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.red} />
      </View>
    );
  }

  const mySeat = hand?.seat ?? players.find((p) => p.userId === userId)?.seat;
  if (notFound || !match || !mySeat) {
    return (
      <Screen title="Partida indisponível">
        <Notice kind="info" message="Esta partida não existe ou você não joga nela." />
        <Button label="Voltar ao início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  const state = match.state;
  const myTeam: Team = mySeat % 2 === 1 ? 'A' : 'B';
  const theirTeam: Team = myTeam === 'A' ? 'B' : 'A';
  const legal = getLegalActions(state, mySeat);
  const nameOf = (seat: Seat) =>
    seat === mySeat ? 'Você' : players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;

  async function act(key: string, action: GameAction) {
    if (!match) return;
    setBusy(key);
    setError(null);
    const result = await submitAction(match.matchId, action, match.revision);
    if (!result.ok) setError(errorMessage(result.error));
    await refresh();
    setBusy(null);
  }

  function confirmFold() {
    Alert.alert('Correr?', `A outra dupla ganha ${state.maoDeOnze === myTeam ? 1 : state.handValue} ponto(s) e começa outra mão.`, [
      { text: 'Continuar jogando', style: 'cancel' },
      { text: 'Correr', style: 'destructive', onPress: () => act('fold', { type: 'fold' }) },
    ]);
  }

  function leaveTable() {
    Alert.alert('Sair da mesa?', 'A partida continua. Para voltar, entre de novo com o código da sala.', [
      { text: 'Ficar', style: 'cancel' },
      { text: 'Sair', onPress: () => router.replace('/') },
    ]);
  }

  const handCardWidth = Math.min(116, (width - space.md * 2 - space.sm * 2) / 3);
  const tableCardWidth = Math.min(64, width / 6.5);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} bounces={false}>
        <View style={styles.felt}>
          <ScoreBar state={state} myTeam={myTeam} theirTeam={theirTeam} onLeave={leaveTable} />
          {connection === 'reconnecting' ? <Text style={styles.reconnecting}>⟳ Reconectando...</Text> : null}
          <Table state={state} mySeat={mySeat} myTeam={myTeam} nameOf={nameOf} cardWidth={tableCardWidth} />
          <StatusLine state={state} mySeat={mySeat} myTeam={myTeam} nameOf={nameOf} canRespond={legal.respondTruco} />
        </View>

        <View style={styles.handArea}>
          <Notice kind="error" message={error} />
          <View style={styles.hand} accessibilityLabel="Suas cartas">
            {(hand?.cards ?? []).map((card) => (
              <HandCard
                key={`${card.rank}_${card.suit}`}
                card={card}
                width={handCardWidth}
                manilha={card.rank === state.manilhaRank}
                canPlay={legal.playCard && !busy}
                onPlay={() => act(`card-${card.rank}${card.suit}`, { type: 'play_card', card })}
              />
            ))}
            {hand && hand.cards.length === 0 && state.status === 'playing' ? (
              <Text style={styles.emptyHand}>Aguardando a próxima mão...</Text>
            ) : null}
          </View>

          {legal.respondTruco && state.truco ? (
            <View style={styles.actions}>
              <Button label="Aceitar" variant="dark" style={styles.action} loading={busy === 'accept'} disabled={!!busy}
                onPress={() => act('accept', { type: 'respond_truco', response: 'accept' })} />
              <Button label="Correr" variant="secondary" style={styles.action} loading={busy === 'refuse'} disabled={!!busy}
                onPress={() => act('refuse', { type: 'respond_truco', response: 'refuse' })} />
              {legal.raiseTruco ? (
                <Button label={`Pedir ${trucoName(nextValue(state.truco.value))}`} variant="gold" style={styles.action}
                  loading={busy === 'raise'} disabled={!!busy}
                  onPress={() => act('raise', { type: 'respond_truco', response: 'raise' })} />
              ) : null}
            </View>
          ) : state.status === 'playing' ? (
            <View style={styles.actions}>
              {legal.requestTruco && legal.nextTrucoValue ? (
                <Button label={`${trucoName(legal.nextTrucoValue)}!`} variant="gold" style={styles.action}
                  loading={busy === 'truco'} disabled={!!busy} hint={`Pede para a mão valer ${legal.nextTrucoValue}`}
                  onPress={() => act('truco', { type: 'request_truco' })} />
              ) : null}
              {legal.fold ? (
                <Button label="Correr" variant="secondary" style={styles.action} loading={busy === 'fold'} disabled={!!busy}
                  onPress={confirmFold} />
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>

      {state.status === 'finished' ? (
        <FinishedOverlay
          won={state.winnerTeam === myTeam}
          score={`${state.score[myTeam]} × ${state.score[theirTeam]}`}
          onRoom={() => router.replace(match.roomCode ? `/room/${match.roomCode}` : '/')}
          onNote={() => router.push({ pathname: '/history/note', params: { matchId: match.matchId } })}
          onHome={() => router.replace('/')}
        />
      ) : null}
    </SafeAreaView>
  );
}

function nextValue(value: number): number {
  return value === 3 ? 6 : value === 6 ? 9 : 12;
}

function ScoreBar({ state, myTeam, theirTeam, onLeave }: { state: PublicGameState; myTeam: Team; theirTeam: Team; onLeave: () => void }) {
  return (
    <View style={styles.scoreBar}>
      <Button label="✕" variant="secondary" onPress={onLeave} style={styles.leave} hint="Sair da mesa" />
      <View style={styles.score} accessible accessibilityLabel={`Placar: nós ${state.score[myTeam]}, eles ${state.score[theirTeam]}`}>
        <Text style={styles.scoreTeam}>Nós</Text>
        <Text style={styles.scoreValue}>{state.score[myTeam]}</Text>
        <Text style={styles.scoreX}>×</Text>
        <Text style={styles.scoreValue}>{state.score[theirTeam]}</Text>
        <Text style={styles.scoreTeam}>Eles</Text>
      </View>
      <View style={styles.handInfo} accessible accessibilityLabel={`Mão ${state.handNumber}, vale ${state.handValue}`}>
        <Text style={styles.handValue}>Vale {state.handValue}</Text>
        <Text style={styles.handNumber}>Mão {state.handNumber}</Text>
      </View>
    </View>
  );
}

interface TableProps {
  state: PublicGameState;
  mySeat: Seat;
  myTeam: Team;
  nameOf: (seat: Seat) => string;
  cardWidth: number;
}

function Table({ state, mySeat, myTeam, nameOf, cardWidth }: TableProps) {
  const pos = tablePositions(mySeat);
  // Depois da 4ª carta a mesa limpa; mostramos a última vaza esmaecida para todos verem o que caiu.
  const showingLast = state.tableCards.length === 0 && state.lastTrick !== null;
  const cards = showingLast ? state.lastTrick!.cards : state.tableCards;
  const tableSeats = state.tableCards.map((c) => c.seat);

  const spot = (seat: Seat) => (
    <SeatSpot
      seat={seat}
      name={nameOf(seat)}
      isTurn={state.status === 'playing' && state.currentTurnSeat === seat}
      team={seat % 2 === 1 ? 'A' : 'B'}
      myTeam={myTeam}
      card={cards.find((c) => c.seat === seat)?.card}
      dimmed={showingLast}
      left={seat === mySeat ? null : cardsLeft(seat, state.trickResults.length, tableSeats, state.status === 'finished')}
      cardWidth={cardWidth}
    />
  );

  return (
    <View style={styles.table}>
      {spot(pos.top)}
      <View style={styles.middle}>
        {spot(pos.left)}
        <View style={styles.vira} accessible accessibilityLabel={`Vira: ${cardLabel(state.vira)}. Manilha: ${state.manilhaRank}`}>
          <Text style={styles.viraLabel}>Vira</Text>
          <PlayingCard card={state.vira} width={cardWidth * 0.9} />
          <Text style={styles.manilha}>Manilha: {state.manilhaRank}</Text>
        </View>
        {spot(pos.right)}
      </View>
      {spot(pos.bottom)}
      <View style={styles.tricks} accessible accessibilityLabel={`Vazas desta mão: ${state.trickResults.map((r) => describeTrick(r, myTeam)).join(', ') || 'nenhuma'}`}>
        {[0, 1, 2].map((i) => {
          const result = state.trickResults[i];
          const label = result === undefined ? '○' : result === 'tie' ? '=' : result === myTeam ? 'N' : 'E';
          return (
            <View key={i} style={[styles.trickDot, result && result !== 'tie' && { backgroundColor: result === myTeam ? colors.gold : colors.feltText }]}>
              <Text style={styles.trickText}>{label}</Text>
            </View>
          );
        })}
        <Text style={styles.trickLegend}>N = nossa · E = deles</Text>
      </View>
    </View>
  );
}

interface SeatSpotProps {
  seat: Seat;
  name: string;
  isTurn: boolean;
  team: Team;
  myTeam: Team;
  card: Card | undefined;
  dimmed: boolean;
  left: number | null;
  cardWidth: number;
}

function SeatSpot({ name, isTurn, team, myTeam, card, dimmed, left, cardWidth }: SeatSpotProps) {
  return (
    <View style={styles.spot}>
      <View style={[styles.nameTag, isTurn && styles.nameTagTurn]}>
        <Text style={[styles.nameText, isTurn && styles.nameTextTurn]} numberOfLines={1}>
          {isTurn ? '▶ ' : ''}
          {name}
        </Text>
        <Text style={[styles.teamText, isTurn && styles.nameTextTurn]}>
          {teamLabel(team, myTeam)}
          {left !== null ? ` · ${left} ${left === 1 ? 'carta' : 'cartas'}` : ''}
        </Text>
      </View>
      {card ? (
        <PlayingCard card={card} width={cardWidth} dimmed={dimmed} />
      ) : (
        <View style={[styles.emptySlot, { width: cardWidth, height: cardWidth * 1.45 }]} />
      )}
    </View>
  );
}

interface StatusProps {
  state: PublicGameState;
  mySeat: Seat;
  myTeam: Team;
  nameOf: (seat: Seat) => string;
  canRespond: boolean;
}

function StatusLine({ state, mySeat, myTeam, nameOf, canRespond }: StatusProps) {
  if (state.status === 'finished') return null;

  let main: string;
  if (state.truco) {
    const who = nameOf(state.truco.requestedBySeat);
    const call = trucoName(state.truco.value);
    main = canRespond ? `${who} pediu ${call}! Responda abaixo.` : `${who} pediu ${call}. Aguardando a resposta deles.`;
  } else if (state.currentTurnSeat === mySeat) {
    main = 'Sua vez! Toque numa carta.';
  } else {
    main = `Vez de ${nameOf(state.currentTurnSeat)}`;
  }

  // Resumo do que acabou de acontecer: fim de mão ou última vaza.
  let recap: string | null = null;
  if (state.tableCards.length === 0) {
    if (state.trickResults.length === 0 && state.lastHand) recap = describeHand(state.lastHand, myTeam);
    else if (state.lastTrick) recap = describeTrick(state.lastTrick.result, myTeam);
  }

  const extra = state.maoDeOnze
    ? state.maoDeOnze === 'both'
      ? 'Mão de ferro: vale 1, sem truco.'
      : `Mão de 11 (${teamLabel(state.maoDeOnze, myTeam)}): vale 3, sem truco.`
    : null;

  return (
    <View style={[styles.status, state.truco && styles.statusTruco]} accessibilityLiveRegion="polite">
      <Text style={[styles.statusMain, state.truco && styles.statusMainTruco]}>{main}</Text>
      {recap ? <Text style={styles.statusRecap}>{recap}</Text> : null}
      {extra ? <Text style={styles.statusRecap}>{extra}</Text> : null}
    </View>
  );
}

function HandCard({ card, width, manilha, canPlay, onPlay }: { card: Card; width: number; manilha: boolean; canPlay: boolean; onPlay: () => void }) {
  return (
    <View style={styles.handCard}>
      <PlayingCard card={card} width={width} highlighted={manilha} onPress={onPlay} disabled={!canPlay}
        hint={canPlay ? 'Joga esta carta na mesa' : 'Espere a sua vez'} />
      <Text style={styles.handCardLabel}>{manilha ? '★ manilha' : ' '}</Text>
    </View>
  );
}

function FinishedOverlay({ won, score, onRoom, onNote, onHome }: { won: boolean; score: string; onRoom: () => void; onNote: () => void; onHome: () => void }) {
  return (
    <View style={styles.overlay}>
      <View style={styles.overlayCard} accessibilityViewIsModal>
        <Text style={styles.overlayTitle}>{won ? 'Vocês venceram!' : 'Eles venceram'}</Text>
        <Text style={styles.overlayScore}>Nós {score} Eles</Text>
        <Button label="Voltar para a sala" onPress={onRoom} />
        <Button label="Escrever nota sobre a partida" variant="dark" onPress={onNote} />
        <Button label="Início" variant="secondary" onPress={onHome} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.felt },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream },
  scroll: { flexGrow: 1 },
  felt: { backgroundColor: colors.felt, paddingHorizontal: space.sm, paddingBottom: space.sm, gap: space.xs },
  reconnecting: { color: colors.gold, fontSize: font.body, fontWeight: '700', textAlign: 'center' },

  scoreBar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
  leave: { minHeight: 48, paddingHorizontal: space.md },
  score: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  scoreTeam: { color: colors.feltText, fontSize: font.body, fontWeight: '700' },
  scoreValue: { color: colors.paper, fontSize: font.huge - 6, fontWeight: '900' },
  scoreX: { color: colors.feltText, fontSize: font.large },
  handInfo: { alignItems: 'flex-end' },
  handValue: { color: colors.gold, fontSize: font.large, fontWeight: '900' },
  handNumber: { color: colors.feltText, fontSize: font.small },

  table: { alignItems: 'center', gap: space.xs, backgroundColor: colors.feltLight, borderRadius: radius.lg, padding: space.sm },
  middle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', alignSelf: 'stretch' },
  vira: { alignItems: 'center', gap: 2 },
  viraLabel: { color: colors.feltText, fontSize: font.small, fontWeight: '700' },
  manilha: { color: colors.gold, fontSize: font.small + 1, fontWeight: '800' },
  spot: { alignItems: 'center', gap: 4, minWidth: 96 },
  nameTag: { backgroundColor: '#00000040', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: 2, alignItems: 'center', maxWidth: 130 },
  nameTagTurn: { backgroundColor: colors.gold },
  nameText: { color: colors.paper, fontSize: font.small + 1, fontWeight: '800' },
  nameTextTurn: { color: colors.ink },
  teamText: { color: colors.feltText, fontSize: font.small - 2 },
  emptySlot: { borderRadius: radius.sm, borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFFFFF40' },
  tricks: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs },
  trickDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.feltText, alignItems: 'center', justifyContent: 'center' },
  trickText: { color: colors.ink, fontWeight: '900', fontSize: font.small },
  trickLegend: { color: colors.feltText, fontSize: font.small - 2, marginLeft: space.xs },

  status: { backgroundColor: '#00000033', borderRadius: radius.md, padding: space.sm, gap: 2 },
  statusTruco: { backgroundColor: colors.gold },
  statusMain: { color: colors.paper, fontSize: font.large, fontWeight: '900', textAlign: 'center' },
  statusMainTruco: { color: colors.ink },
  statusRecap: { color: colors.feltText, fontSize: font.small + 1, textAlign: 'center' },

  handArea: { flexGrow: 1, backgroundColor: colors.cream, padding: space.md, gap: space.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  hand: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, minHeight: 120, alignItems: 'flex-end' },
  handCard: { alignItems: 'center' },
  handCardLabel: { fontSize: font.small, color: colors.ink, fontWeight: '700' },
  emptyHand: { fontSize: font.body, color: colors.muted, alignSelf: 'center' },
  actions: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  action: { flexGrow: 1, flexBasis: 100 },

  overlay: { ...StyleSheet.absoluteFill, backgroundColor: '#000000AA', justifyContent: 'center', padding: space.lg },
  overlayCard: { backgroundColor: colors.cream, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  overlayTitle: { fontSize: font.title + 4, fontWeight: '900', color: colors.ink, textAlign: 'center' },
  overlayScore: { fontSize: font.large, fontWeight: '700', color: colors.muted, textAlign: 'center' },
});
