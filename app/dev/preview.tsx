// FIXTURE LOCAL, só em desenvolvimento: simula o servidor com o próprio motor de regras para ver
// e testar a mesa sem Supabase e sem 4 aparelhos. Não é o multiplayer real: aqui as quatro mãos
// existem no mesmo aparelho. A barra de cima deixa claro que é uma demonstração controlada.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyAction, getLegalActions, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { MatchState } from '../../supabase/functions/_shared/engine/index.ts';
import type { GameAction, GameResult, MatchPlayer, MatchView, Seat } from '../../src/contracts/types';
import { PlayerGame } from '../../src/game/PlayerGame';
import { TableGame } from '../../src/game/TableGame';
import { SeatPicker } from '../../src/rooms/SeatPicker';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space } from '../../src/ui/theme';

const PLAYERS: MatchPlayer[] = [
  { seat: 1, team: 'A', userId: 'u1', displayName: 'Ana' },
  { seat: 2, team: 'B', userId: 'u2', displayName: 'Bia' },
  { seat: 3, team: 'A', userId: 'u3', displayName: 'Caio' },
  { seat: 4, team: 'B', userId: 'u4', displayName: 'Duda' },
];

// Nomes longos, para conferir truncamento e alinhamento nas etiquetas.
const LONG_PLAYERS: MatchPlayer[] = [
  { seat: 1, team: 'A', userId: 'u1', displayName: 'Ana Carolina Albuquerque' },
  { seat: 2, team: 'B', userId: 'u2', displayName: 'Bianca Mendonça' },
  { seat: 3, team: 'A', userId: 'u3', displayName: 'Caio Yuri Lacerda' },
  { seat: 4, team: 'B', userId: 'u4', displayName: 'Maria Eduarda Sant’Anna' },
];

type Quick = 'truco' | 'accept' | 'refuse' | 'play' | 'partner';

type View_ = Seat | 'table' | 'lobby';

export default function Preview() {
  if (!__DEV__) {
    return (
      <Screen title="Indisponível">
        <Button label="Início" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  return <Fixture />;
}

function Fixture() {
  const rng = useRef(seededRng(Date.now() % 100000)).current;
  const matchId = useRef(`fixture-${Date.now()}`).current;
  const [game, setGame] = useState<{ state: MatchState; revision: number }>(() => ({ state: newMatch(rng), revision: 0 }));
  const gameRef = useRef(game);
  gameRef.current = game;
  const [view, setView] = useState<View_>(1);
  // Com mesa dedicada (5 aparelhos) o jogador vê só a mão e o essencial; sem ela, a mesa fica em cima.
  const [withTable, setWithTable] = useState(true);
  const [longNames, setLongNames] = useState(false);
  const players = longNames ? LONG_PLAYERS : PLAYERS;

  const match: MatchView = {
    matchId,
    roomId: 'fixture',
    roomCode: null,
    revision: game.revision,
    state: game.state.public,
    tableUserId: withTable ? 'mesa' : null,
  };

  // Faz o papel do submit-action: confere a revisão e aplica a regra do motor.
  async function submit(_: string, action: GameAction, expectedRevision: number): Promise<GameResult> {
    await new Promise((r) => setTimeout(r, 250));
    const current = gameRef.current;
    if (view === 'table' || view === 'lobby') return { ok: false, error: 'not_member' };
    if (expectedRevision !== current.revision) return { ok: false, error: 'conflict' };
    const result = applyAction(current.state, view, action, rng);
    if (!result.ok) return { ok: false, error: result.error };
    const next = { state: result.state, revision: current.revision + 1 };
    gameRef.current = next;
    setGame(next);
    return { ok: true, newRevision: next.revision };
  }

  // Atalhos da fixture: aplicam a ação pelo lugar que agiria agora, sem sair da visão atual
  // (útil para ver os avisos de truco na mesa central, que não tem botões de jogo).
  function quick(kind: Quick) {
    const current = gameRef.current;
    const pub = current.state.public;
    if (pub.status !== 'playing') return;
    // Decisão da dupla em aberto: o parceiro de quem pediu confirma.
    if (kind === 'partner') {
      if (!pub.proposal) return;
      const partner = (((pub.proposal.proposedBy + 1) % 4) + 1) as Seat;
      commit(applyAction(current.state, partner, { type: 'confirm_proposal', proposalId: pub.proposal.id }, rng));
      return;
    }
    const responder = pub.truco ? (((pub.truco.requestedBySeat % 4) + 1) as Seat) : pub.currentTurnSeat;
    const legal = getLegalActions(pub, responder);
    let action: GameAction | null = null;
    if (kind === 'truco') {
      if (pub.truco && legal.raiseTruco) action = { type: 'respond_truco', response: 'raise' };
      else if (!pub.truco && legal.requestTruco) action = { type: 'request_truco' };
    } else if (kind === 'accept' && pub.truco) action = { type: 'respond_truco', response: 'accept' };
    else if (kind === 'refuse') action = pub.truco ? { type: 'respond_truco', response: 'refuse' } : { type: 'fold' };
    else if (kind === 'play' && legal.playCard) action = { type: 'play_card', card: current.state.hands[responder - 1][0] };
    if (!action) return;
    commit(applyAction(current.state, responder, action, rng));
  }

  function commit(result: ReturnType<typeof applyAction>) {
    if (!result.ok) return;
    const next = { state: result.state, revision: gameRef.current.revision + 1 };
    gameRef.current = next;
    setGame(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <Text style={styles.badge}>FIXTURE LOCAL · sem servidor</Text>
        <View style={styles.tabs}>
          {[true, false].map((mode) => (
            <Pressable
              key={String(mode)}
              onPress={() => {
                setWithTable(mode);
                if (!mode && view === 'table') setView(1);
              }}
              style={[styles.tab, withTable === mode && styles.tabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: withTable === mode }}
            >
              <Text style={[styles.tabText, withTable === mode && styles.tabTextOn]}>
                {mode ? 'Com mesa (5 aparelhos)' : 'Sem mesa (4 aparelhos)'}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabs}>
          {((withTable ? [1, 2, 3, 4, 'table', 'lobby'] : [1, 2, 3, 4, 'lobby']) as View_[]).map((v) => (
            <Pressable
              key={String(v)}
              onPress={() => setView(v)}
              style={[styles.tab, view === v && styles.tabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
            >
              <Text style={[styles.tabText, view === v && styles.tabTextOn]}>
                {v === 'table' ? 'Mesa' : v === 'lobby' ? 'Sala' : `Lugar ${v}`}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tabs}>
          {(
            [
              ['truco', 'Truco/+'],
              ['accept', 'Aceitar'],
              ['refuse', 'Correr'],
              ['play', 'Jogar'],
              ['partner', 'Dupla ✓'],
            ] as [Quick, string][]
          ).map(([kind, label]) => (
            <Pressable
              key={kind}
              onPress={() => quick(kind)}
              style={styles.tab}
              accessibilityRole="button"
              accessibilityLabel={`Simular: ${label}`}
            >
              <Text style={styles.tabText}>{label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setLongNames((v) => !v)}
            style={[styles.tab, longNames && styles.tabOn]}
            accessibilityRole="button"
            accessibilityState={{ selected: longNames }}
          >
            <Text style={[styles.tabText, longNames && styles.tabTextOn]}>Nomes longos</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.game}>
        {view === 'lobby' ? (
          // Seleção de lugares como na sala: lugar 4 livre para ver o estado "Livre".
          <Screen>
            <SeatPicker
              seats={players.slice(0, 3).map((p, i) => ({ ...p, ready: i !== 1 }))}
              mySeat={1}
              hostId="u2"
              disabled={false}
              canSit
              onSit={() => {}}
            />
          </Screen>
        ) : view === 'table' ? (
          <TableGame match={match} players={players} connection="online" />
        ) : (
          <PlayerGame
            key={`${view}-${withTable}`}
            match={match}
            hand={{ revision: game.revision, seat: view, cards: game.state.hands[view - 1] }}
            players={players}
            mySeat={view}
            connection="online"
            refresh={async () => {}}
            submit={submit}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bar: { paddingHorizontal: space.sm, paddingBottom: space.xs, gap: 4 },
  badge: { color: colors.gold, fontSize: font.small - 2, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: '#FFFFFF1A', alignItems: 'center' },
  tabOn: { backgroundColor: colors.gold },
  tabText: { color: colors.text, fontSize: font.small - 2, fontWeight: '800' },
  tabTextOn: { color: colors.ink },
  game: { flex: 1 },
});
