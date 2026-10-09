// FIXTURE LOCAL, só em desenvolvimento: simula o servidor com o próprio motor de regras para ver
// e testar a mesa sem Supabase e sem 4 aparelhos. Não é o multiplayer real: aqui as quatro mãos
// existem no mesmo aparelho. A barra de cima deixa claro que é uma demonstração controlada.
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { applyAction, newMatch, seededRng } from '../../supabase/functions/_shared/engine/index.ts';
import type { MatchState } from '../../supabase/functions/_shared/engine/index.ts';
import type { GameAction, GameResult, MatchPlayer, MatchView, Seat } from '../../src/contracts/types';
import { PlayerGame } from '../../src/game/PlayerGame';
import { TableGame } from '../../src/game/TableGame';
import { Button } from '../../src/ui/Button';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space } from '../../src/ui/theme';

const PLAYERS: MatchPlayer[] = [
  { seat: 1, team: 'A', userId: 'u1', displayName: 'Ana' },
  { seat: 2, team: 'B', userId: 'u2', displayName: 'Bia' },
  { seat: 3, team: 'A', userId: 'u3', displayName: 'Caio' },
  { seat: 4, team: 'B', userId: 'u4', displayName: 'Duda' },
];

type View_ = Seat | 'table';

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

  const match: MatchView = {
    matchId,
    roomId: 'fixture',
    roomCode: null,
    revision: game.revision,
    state: game.state.public,
    tableUserId: 'mesa',
  };

  // Faz o papel do submit-action: confere a revisão e aplica a regra do motor.
  async function submit(_: string, action: GameAction, expectedRevision: number): Promise<GameResult> {
    await new Promise((r) => setTimeout(r, 250));
    const current = gameRef.current;
    if (view === 'table') return { ok: false, error: 'not_member' };
    if (expectedRevision !== current.revision) return { ok: false, error: 'conflict' };
    const result = applyAction(current.state, view, action, rng);
    if (!result.ok) return { ok: false, error: result.error };
    const next = { state: result.state, revision: current.revision + 1 };
    gameRef.current = next;
    setGame(next);
    return { ok: true, newRevision: next.revision };
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.bar}>
        <Text style={styles.badge}>FIXTURE LOCAL · sem servidor</Text>
        <View style={styles.tabs}>
          {([1, 2, 3, 4, 'table'] as View_[]).map((v) => (
            <Pressable
              key={String(v)}
              onPress={() => setView(v)}
              style={[styles.tab, view === v && styles.tabOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: view === v }}
            >
              <Text style={[styles.tabText, view === v && styles.tabTextOn]}>{v === 'table' ? 'Mesa' : `Lugar ${v}`}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.game}>
        {view === 'table' ? (
          <TableGame match={match} players={PLAYERS} connection="online" />
        ) : (
          <PlayerGame
            key={view}
            match={match}
            hand={{ revision: game.revision, seat: view, cards: game.state.hands[view - 1] }}
            players={PLAYERS}
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
  safe: { flex: 1, backgroundColor: colors.ink },
  bar: { paddingHorizontal: space.sm, paddingBottom: space.xs, gap: 4 },
  badge: { color: colors.gold, fontSize: font.small - 2, fontWeight: '900', textAlign: 'center', letterSpacing: 1 },
  tabs: { flexDirection: 'row', gap: 4 },
  tab: { flex: 1, paddingVertical: 6, borderRadius: radius.sm, backgroundColor: '#FFFFFF1A', alignItems: 'center' },
  tabOn: { backgroundColor: colors.gold },
  tabText: { color: colors.paper, fontSize: font.small - 2, fontWeight: '800' },
  tabTextOn: { color: colors.ink },
  game: { flex: 1 },
});
