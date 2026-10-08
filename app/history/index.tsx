import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../../src/auth/AuthProvider';
import type { MatchNote, MatchSummary } from '../../src/contracts/types';
import { deleteNote, fetchMyMatches, listNotes } from '../../src/history/api';
import { errorMessage } from '../../src/lib/errors';
import { Button } from '../../src/ui/Button';
import { Notice } from '../../src/ui/Notice';
import { Screen } from '../../src/ui/Screen';
import { colors, font, radius, space } from '../../src/ui/theme';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export default function History() {
  const { userId } = useAuth();
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [notes, setNotes] = useState<MatchNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setError(null);
    try {
      const [m, n] = await Promise.all([fetchMyMatches(userId), listNotes()]);
      setMatches(m);
      setNotes(n);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // READ: recarrega sempre que a tela volta ao foco (depois de criar ou editar).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(note: MatchNote) {
    Alert.alert('Excluir nota?', `"${note.title}" será apagada. Não dá para desfazer.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteNote(note.id);
            setInfo('Nota excluída.');
            await load();
          } catch (e) {
            setError(errorMessage(e));
          }
        },
      },
    ]);
  }

  const matchById = new Map(matches.map((m) => [m.id, m]));

  return (
    <Screen title="Histórico">
      <Notice kind="error" message={error} />
      <Notice kind="success" message={info} />

      <Text style={styles.section} accessibilityRole="header">
        Minhas notas
      </Text>
      {!loading && notes.length === 0 ? (
        <Text style={styles.empty}>Nenhuma nota ainda. Crie uma a partir de uma partida abaixo.</Text>
      ) : null}
      {notes.map((note) => {
        const match = matchById.get(note.matchId);
        return (
          <View key={note.id} style={styles.card}>
            <Text style={styles.cardTitle}>{note.title}</Text>
            {note.notes ? <Text style={styles.cardBody}>{note.notes}</Text> : null}
            <Text style={styles.meta}>
              {match ? `Partida de ${formatDate(match.startedAt)} · ` : ''}editada {formatDate(note.updatedAt)}
            </Text>
            <View style={styles.row}>
              <Button
                label="Editar"
                variant="dark"
                style={styles.flex}
                onPress={() => router.push({ pathname: '/history/note', params: { id: note.id } })}
              />
              <Button label="Excluir" variant="secondary" style={styles.flex} onPress={() => confirmDelete(note)} />
            </View>
          </View>
        );
      })}

      <Text style={styles.section} accessibilityRole="header">
        Minhas partidas
      </Text>
      {!loading && matches.length === 0 ? <Text style={styles.empty}>Você ainda não jogou nenhuma partida.</Text> : null}
      {matches.map((match) => {
        const mine = match.myTeam === 'A' ? match.scoreA : match.scoreB;
        const theirs = match.myTeam === 'A' ? match.scoreB : match.scoreA;
        const result =
          match.status === 'playing' ? 'Em andamento' : match.winnerTeam === match.myTeam ? 'Vitória' : 'Derrota';
        return (
          <View key={match.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardTitle, result === 'Vitória' && { color: colors.success }]}>{result}</Text>
              <Text style={styles.cardTitle}>
                Nós {mine} × {theirs} Eles
              </Text>
            </View>
            <Text style={styles.meta}>{formatDate(match.startedAt)}</Text>
            <Button
              label="Nova nota"
              variant="secondary"
              onPress={() => router.push({ pathname: '/history/note', params: { matchId: match.id } })}
            />
          </View>
        );
      })}

      <Button label="Voltar" variant="secondary" onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: font.large, fontWeight: '800', color: colors.ink, marginTop: space.sm },
  empty: { fontSize: font.body, color: colors.muted },
  card: { backgroundColor: colors.paper, borderRadius: radius.md, borderWidth: 2, borderColor: colors.border, padding: space.md, gap: space.sm },
  cardTitle: { fontSize: font.large, fontWeight: '800', color: colors.ink },
  cardBody: { fontSize: font.body, color: colors.ink },
  meta: { fontSize: font.small, color: colors.muted },
  row: { flexDirection: 'row', gap: space.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.sm },
  flex: { flex: 1 },
});
