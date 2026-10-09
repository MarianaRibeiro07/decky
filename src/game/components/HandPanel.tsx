import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOutUp,
  LayoutAnimationConfig,
  LinearTransition,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import type { LegalActions } from '../../../supabase/functions/_shared/engine/game.ts';
import type { Card, GameAction, PrivateHand, PublicGameState, Rank, Seat } from '../../contracts/types';
import { useRerenderAt } from '../../lib/useRerenderAt';
import { Button } from '../../ui/Button';
import type { IconName } from '../../ui/icons';
import { Notice } from '../../ui/Notice';
import { CARD_RATIO, cardLabel, PlayingCard, sealSize } from '../../ui/PlayingCard';
import { colors, font, radius, space } from '../../ui/theme';
import { trucoControls, type Control, type ControlId } from '../controls';
import { arrivedCards, landingMoments, type DealRun } from '../deal';
import { cardKey as keyOf, manilhaReveals, revealMoments, revealProgress, showsManilha, type ManilhaReveal as Reveal } from '../manilha';
import type { DealAnimation } from '../useDealAnimation';
import { ManilhaReveal } from './ManilhaReveal';

const NO_MOMENTS: number[] = [];

const CONTROL_ICONS: Record<ControlId, IconName> = {
  request: 'raise',
  raise: 'raise',
  accept: 'accept',
  refuse: 'fold',
  fold: 'fold',
};

/**
 * Quantas cartas da própria mão já "chegaram" na distribuição animada. Calculado no render
 * (o primeiro quadro da mão nova já sai sem cartas) e redesenhado só quando uma carta pousa.
 */
function useArrivedCards(deal: DealAnimation, dealing: boolean, dealerSeat: Seat, mySeat: Seat): number {
  const run = dealing ? deal.run : null;
  useRerenderAt(run ? landingMoments(run, dealerSeat, mySeat) : NO_MOMENTS);
  return arrivedCards(run, dealerSeat, mySeat, Date.now());
}

/**
 * Plano das revelações de manilha desta distribuição. Fica fixo depois de feito com a mão recebida:
 * jogar uma manilha no meio da sequência não reescalona as outras (não corta nem repete efeito).
 * Só é refeito quando muda a distribuição ou a vira, ou quando a mão chega depois do estado novo.
 */
function useManilhaReveals(run: DealRun | null, cards: Card[], manilhaRank: Rank): Reveal[] {
  const plan = useRef<{ run: DealRun | null; rank: Rank; dealt: number; reveals: Reveal[] } | null>(null);
  const current = plan.current;
  if (!current || current.run !== run || current.rank !== manilhaRank || (current.dealt === 0 && cards.length > 0)) {
    plan.current = { run, rank: manilhaRank, dealt: cards.length, reveals: manilhaReveals(run, cards, manilhaRank) };
  }
  const reveals = plan.current!.reveals;
  useRerenderAt(reveals.length > 0 ? revealMoments(reveals) : NO_MOMENTS);
  return reveals;
}

interface Props {
  state: PublicGameState;
  hand: PrivateHand | null;
  mySeat: Seat;
  legal: LegalActions;
  deal: DealAnimation;
  /** Chave da ação em envio (desabilita tudo e mostra carregando no botão certo). */
  busy: string | null;
  error: string | null;
  onAct: (key: string, action: GameAction) => void;
  /** Área segura de baixo (barra de gestos), somada ao espaçamento do painel. */
  bottomInset: number;
  /** 'large' quando a mão ocupa a tela (modo com mesa dedicada): cartas maiores. */
  size?: 'normal' | 'large';
}

/**
 * Metade de baixo da tela do jogador: as três cartas privadas e os controles.
 * Fluxo da carta: tocar seleciona (a carta sobe e ganha borda), confirmar envia ao servidor.
 * Tocar de novo na carta selecionada também confirma.
 *
 * Manilhas: contorno, halo e selo com estrela na própria carta, calculados com a mão privada (que só
 * este aparelho recebe) e a manilha pública. Ao receber a mão, cada manilha ganha uma revelação
 * especial depois que a vira abre; ela não bloqueia a jogada e não se repete (ver `manilhaReveals`).
 */
export function HandPanel({ state, hand, mySeat, legal, deal, busy, error, onAct, bottomInset, size = 'normal' }: Props) {
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmFold, setConfirmFold] = useState(false);

  const cards = hand?.cards ?? [];
  const dealing = deal.phase === 'intro' || deal.phase === 'dealing';
  const canPlay = legal.playCard && !busy && !dealing;
  const { mode, controls } = trucoControls(state, legal);
  const selectedCard = cards.find((c) => keyOf(c) === selected) ?? null;

  // A seleção some quando a carta sai da mão (jogada aceita ou mão nova) ou quando surge um pedido de truco.
  useEffect(() => {
    if (selected && !cards.some((c) => keyOf(c) === selected)) setSelected(null);
  }, [cards, selected]);
  useEffect(() => {
    if (state.truco) {
      setSelected(null);
      setConfirmFold(false);
    }
  }, [state.truco]);

  const large = size === 'large';
  const cardW = Math.min(large ? 150 : 112, (width - space.md * 2 - space.sm * 2) / 3, height * (large ? 0.21 : 0.13));
  const reveals = useManilhaReveals(deal.run, cards, state.manilhaRank);
  const now = Date.now();

  function tapCard(card: Card) {
    if (dealing || busy) return;
    const key = keyOf(card);
    if (selected === key && canPlay) {
      onAct(`card-${key}`, { type: 'play_card', card });
      return;
    }
    setSelected(selected === key ? null : key);
  }

  function press(control: Control) {
    if (control.confirm) setConfirmFold(true);
    else onAct(control.id, control.action);
  }

  const arrived = useArrivedCards(deal, dealing, state.dealerSeat, mySeat);

  return (
    <View style={[styles.panel, { paddingBottom: space.sm + bottomInset }]}>
      <Notice kind="error" message={error} />

      {/* Abrir a tela ou reconectar não refaz a entrada das cartas que já estavam na mão. */}
      <LayoutAnimationConfig skipEntering>
        <View
          // Em cima, espaço para a carta escolhida subir e para o selo da manilha, que sai do canto.
          style={[styles.hand, { minHeight: cardW * CARD_RATIO + space.xs, paddingTop: Math.max(18, sealSize(cardW) * 0.34 + 12) }]}
          accessibilityLabel="Suas cartas"
        >
          {cards.slice(0, arrived).map((card) => {
            const key = keyOf(card);
            const isSelected = key === selected;
            const reveal = reveals.find((r) => r.key === key);
            const manilha = showsManilha(card, state.manilhaRank, deal.phase, reveal, now);
            const revealing = revealProgress(reveal, now);
            return (
              // A animação de layout fica no invólucro; o deslocamento da seleção vai na view de dentro,
              // para o Reanimated não sobrescrever o `transform` (aviso "may be overwritten by a layout animation").
              <Animated.View
                key={`${state.handNumber}-${key}`}
                entering={dealing ? FadeInDown.duration(260) : FadeIn.duration(200)}
                exiting={FadeOutUp.duration(220)}
                layout={LinearTransition.duration(200)}
              >
                <LiftOnSelect selected={isSelected}>
                  <PlayingCard
                    card={card}
                    width={cardW}
                    selected={isSelected}
                    ready={canPlay}
                    manilha={manilha}
                    dimmed={busy === `card-${key}`}
                    elevation={isSelected ? 'lifted' : 'table'}
                    disabled={dealing || !!busy}
                    onPress={() => tapCard(card)}
                    hint={
                      isSelected
                        ? canPlay
                          ? 'Selecionada. Toque de novo ou em Jogar para confirmar'
                          : 'Selecionada. Espere a sua vez para jogar'
                        : 'Toque para selecionar'
                    }
                  />
                  {revealing !== null ? <ManilhaReveal cardWidth={cardW} from={revealing} /> : null}
                </LiftOnSelect>
              </Animated.View>
            );
          })}
          {hand && cards.length === 0 && state.status === 'playing' ? (
            <Text style={styles.empty}>Sem cartas nesta mão. Aguarde a próxima.</Text>
          ) : null}
        </View>
      </LayoutAnimationConfig>

      {confirmFold ? (
        <Animated.View entering={FadeIn.duration(150)} style={styles.confirm}>
          <Text style={styles.confirmText}>
            Correr? A outra dupla ganha {state.maoDeOnze === (mySeat % 2 === 1 ? 'A' : 'B') ? 1 : state.handValue}{' '}
            ponto(s) e começa outra mão.
          </Text>
          <View style={styles.row}>
            <Button label="Continuar jogando" variant="secondary" size="compact" style={styles.grow} onPress={() => setConfirmFold(false)} />
            <Button
              label="Correr"
              hint="Confirma: desiste da mão"
              icon="fold"
              variant="primary"
              size="compact"
              style={styles.grow}
              loading={busy === 'fold'}
              disabled={!!busy}
              onPress={() => {
                setConfirmFold(false);
                onAct('fold', { type: 'fold' });
              }}
            />
          </View>
        </Animated.View>
      ) : mode === 'respond' ? (
        <View style={styles.row} accessibilityLabel="Responder ao pedido de truco">
          {controls.map((c) => (
            <Button key={c.id} label={c.label} hint={c.hint} icon={CONTROL_ICONS[c.id]} variant={c.variant} size="compact" style={styles.grow}
              loading={busy === c.id} disabled={!!busy} onPress={() => press(c)} />
          ))}
        </View>
      ) : mode === 'waiting_answer' ? (
        <Text style={styles.waiting}>Pedido feito. Aguardando a outra dupla responder…</Text>
      ) : mode === 'play' ? (
        // Correr à esquerda, longe do polegar; jogar à direita, maior e preenchido: é a ação principal.
        <View style={styles.row}>
          {[...controls].reverse().map((c) => (
            <Button key={c.id} label={c.label} hint={c.hint} icon={CONTROL_ICONS[c.id]} variant={c.variant} size="compact"
              style={c.id === 'fold' ? styles.fold : styles.truco}
              loading={busy === c.id} disabled={!!busy || dealing} onPress={() => press(c)} />
          ))}
          <Button
            label={playLabel(dealing, legal.playCard, selectedCard)}
            hint={selectedCard ? `Joga ${cardLabel(selectedCard)} na mesa` : 'Toque numa carta da mão para escolher'}
            icon="play"
            variant="primary"
            size="compact"
            style={styles.play}
            disabled={!selectedCard || !canPlay}
            loading={!!selectedCard && busy === `card-${keyOf(selectedCard)}`}
            onPress={() => selectedCard && onAct(`card-${keyOf(selectedCard)}`, { type: 'play_card', card: selectedCard })}
          />
        </View>
      ) : null}
    </View>
  );
}

/** O rótulo do botão de jogar diz por que ele está parado, em vez de só ficar apagado. */
function playLabel(dealing: boolean, myTurn: boolean, selected: Card | null): string {
  if (dealing) return 'Distribuindo…';
  if (!myTurn) return 'Aguarde a vez';
  if (!selected) return 'Escolha a carta';
  return 'Jogar';
}

/**
 * A carta escolhida sobe com uma mola curta. A animação fica numa view interna: o invólucro de fora
 * tem a animação de layout (entrada, saída e reordenação), que é dona do `transform` dela.
 */
function LiftOnSelect({ selected, children }: { selected: boolean; children: ReactNode }) {
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: withSpring(selected ? -16 : 0, { damping: 16, stiffness: 260 }) }],
  }));
  return <Animated.View style={[styles.slot, lift]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  // Bandeja de couro na frente do jogador: grafite, filete metálico em cima e luz vindo da mesa.
  panel: {
    backgroundColor: colors.surface,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    gap: space.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    boxShadow: '0px -8px 18px rgba(0, 0, 0, 0.55)',
  },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: space.sm },
  slot: { alignItems: 'center' },
  empty: { fontSize: font.body, color: colors.textMuted, alignSelf: 'center', textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  truco: { flex: 1.1 },
  fold: { flex: 0.8 },
  play: { flex: 1.4 },
  waiting: { fontSize: font.body, color: colors.goldSoft, fontWeight: '700', textAlign: 'center', paddingVertical: space.sm },
  confirm: { gap: space.sm },
  confirmText: { fontSize: font.body - 1, color: colors.text, fontWeight: '700', textAlign: 'center' },
});
