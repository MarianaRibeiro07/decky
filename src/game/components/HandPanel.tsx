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
import type { Card, GameAction, MatchPlayer, PrivateHand, PublicGameState, Rank, Seat, TeamProposal } from '../../contracts/types';
import { useRerenderAt } from '../../lib/useRerenderAt';
import { Button } from '../../ui/Button';
import type { IconName } from '../../ui/icons';
import { Notice } from '../../ui/Notice';
import { CARD_RATIO, cardLabel, PlayingCard, sealSize } from '../../ui/PlayingCard';
import { colors, font, radius, space, TOUCH_MIN } from '../../ui/theme';
import { trucoControls, type Control, type ControlId } from '../controls';
import { initials, seatTeam, shortName } from '../describe';
import { arrivedCards, landingMoments, type DealRun } from '../deal';
import { cardKey as keyOf, manilhaReveals, revealMoments, revealProgress, showsManilha, type ManilhaReveal as Reveal } from '../manilha';
import type { DealAnimation } from '../useDealAnimation';
import { ManilhaReveal } from './ManilhaReveal';
import { PlayerAvatar } from './PlayerIdentity';

const NO_MOMENTS: number[] = [];

const CONTROL_ICONS: Record<ControlId, IconName> = {
  request: 'raise',
  raise: 'raise',
  accept: 'accept',
  refuse: 'fold',
  fold: 'fold',
  confirm: 'accept',
  reject: 'no',
  cancel: 'no',
};

/** Recuo lateral do painel: menor sem mesa dedicada, para a mão ganhar largura. */
const panelPadding = (size: 'normal' | 'large') => (size === 'large' ? space.md : space.sm + 4);
const HAND_GAP = space.sm;

/**
 * Largura de cada carta da mão. Três cartas lado a lado na largura do painel, limitadas por uma fração
 * da altura da tela (para a mesa continuar com espaço) e por um teto.
 * - 'normal' (sem mesa dedicada: a mesa fica em cima): até 124 pt e 14% da altura. Antes eram 112 pt e
 *   13%, e a mão ficava apertada; num celular de 390 x 844 a carta passa de ~110 para ~118 pt.
 * - 'large' (com mesa dedicada: a mão ocupa a tela): sem mudança.
 */
export function handCardWidth(width: number, height: number, size: 'normal' | 'large'): number {
  const large = size === 'large';
  const fromWidth = (width - panelPadding(size) * 2 - HAND_GAP * 2) / 3;
  return Math.min(large ? 150 : 124, fromWidth, height * (large ? 0.21 : 0.14));
}

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
  /** Aviso curto da dupla (o parceiro recusou o pedido, o pedido deixou de valer). */
  note: string | null;
  players: MatchPlayer[];
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
export function HandPanel({ state, hand, mySeat, legal, deal, busy, error, note, players, onAct, bottomInset, size = 'normal' }: Props) {
  const { width, height } = useWindowDimensions();
  const [selected, setSelected] = useState<string | null>(null);

  const cards = hand?.cards ?? [];
  const dealing = deal.phase === 'intro' || deal.phase === 'dealing';
  const canPlay = legal.playCard && !busy && !dealing;
  const { mode, controls } = trucoControls(state, legal, mySeat);
  const selectedCard = cards.find((c) => keyOf(c) === selected) ?? null;

  // A seleção some quando a carta sai da mão (jogada aceita ou mão nova) ou quando surge um pedido de truco.
  useEffect(() => {
    if (selected && !cards.some((c) => keyOf(c) === selected)) setSelected(null);
  }, [cards, selected]);
  useEffect(() => {
    if (state.truco) setSelected(null);
  }, [state.truco]);

  const cardW = handCardWidth(width, height, size);
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
    onAct(control.id, control.action);
  }

  const arrived = useArrivedCards(deal, dealing, state.dealerSeat, mySeat);

  return (
    <View style={[styles.panel, { paddingBottom: space.sm + bottomInset, paddingHorizontal: panelPadding(size) }]}>
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

      <Notice kind="info" message={note} />

      {mode === 'proposal_confirm' || mode === 'proposal_sent' ? (
        // Decisão da dupla: quem já confirmou (avatares) e o que falta fazer, na mesma altura da fileira
        // de botões, para a mesa não mudar de tamanho. O que está em jogo vai no banner de status.
        <View style={styles.row} accessibilityLabel="Decisão da dupla">
          <ProposalMembers proposal={state.proposal!} mySeat={mySeat} players={players} />
          {controls.map((c) => (
            <Button key={c.id} label={c.label} hint={c.hint} icon={CONTROL_ICONS[c.id]} variant={c.variant} size="compact"
              style={c.id === 'confirm' ? styles.play : styles.grow} loading={busy === c.id} disabled={!!busy} onPress={() => press(c)} />
          ))}
        </View>
      ) : mode === 'proposal_other' ? (
        <WaitingLine text="A outra dupla está decidindo…" />
      ) : mode === 'respond' ? (
        <View style={styles.row} accessibilityLabel="Responder ao pedido de truco">
          {controls.map((c) => (
            <Button key={c.id} label={c.label} hint={c.hint} icon={CONTROL_ICONS[c.id]} variant={c.variant} size="compact" style={styles.grow}
              loading={busy === c.id} disabled={!!busy} onPress={() => press(c)} />
          ))}
        </View>
      ) : mode === 'waiting_answer' ? (
        <WaitingLine text="Pedido feito. Aguardando a outra dupla responder…" />
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

/**
 * Quem da dupla já confirmou o pedido: avatar com visto dourado para quem confirmou (quem pediu conta
 * como a primeira confirmação) e contorno apagado para quem ainda não respondeu, mais "1 de 2".
 */
function ProposalMembers({ proposal, mySeat, players }: { proposal: TeamProposal; mySeat: Seat; players: MatchPlayer[] }) {
  const partnerSeat = (((proposal.proposedBy + 1) % 4) + 1) as Seat;
  const nameOf = (seat: Seat) => players.find((p) => p.seat === seat)?.displayName ?? `Lugar ${seat}`;
  const label = (seat: Seat) => (seat === mySeat ? 'você' : shortName(nameOf(seat)));
  const members: { seat: Seat; done: boolean }[] = [
    { seat: proposal.proposedBy, done: true },
    { seat: partnerSeat, done: false },
  ];
  return (
    <View
      style={styles.members}
      accessible
      accessibilityLabel={`Confirmações da dupla: 1 de 2. ${label(proposal.proposedBy)} confirmou; falta ${label(partnerSeat)}.`}
    >
      <View style={styles.memberRow}>
        {members.map((m) => (
          <View key={m.seat} style={[styles.member, !m.done && styles.memberWaiting]}>
            <PlayerAvatar initials={initials(nameOf(m.seat))} team={seatTeam(m.seat)} size={26} active={m.done} />
            <View style={[styles.memberMark, m.done ? styles.memberDone : styles.memberPending]}>
              <Text style={[styles.memberMarkText, !m.done && styles.memberMarkPending]} allowFontScaling={false}>
                {m.done ? '✓' : '…'}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Text style={styles.memberCount} allowFontScaling={false}>
        1 DE 2
      </Text>
    </View>
  );
}

/** Linha de espera com a altura da fileira de botões: trocar de modo não muda o tamanho do painel. */
function WaitingLine({ text }: { text: string }) {
  return (
    <View style={styles.waitingBox} accessibilityLiveRegion="polite">
      <Text style={styles.waiting} numberOfLines={2}>
        {text}
      </Text>
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
    paddingTop: space.sm,
    gap: space.sm,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    borderColor: colors.lineStrong,
    boxShadow: '0px -8px 18px rgba(0, 0, 0, 0.55)',
  },
  hand: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: HAND_GAP },
  slot: { alignItems: 'center' },
  empty: { fontSize: font.body, color: colors.textMuted, alignSelf: 'center', textAlign: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  grow: { flex: 1 },
  truco: { flex: 1.1 },
  fold: { flex: 0.8 },
  play: { flex: 1.4 },
  waitingBox: { height: TOUCH_MIN + 4, justifyContent: 'center' },
  waiting: { fontSize: font.body - 2, lineHeight: 21, color: colors.goldSoft, fontWeight: '700', textAlign: 'center' },
  members: {
    flex: 0.9,
    minHeight: TOUCH_MIN + 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.goldDeep,
    backgroundColor: '#1C1810',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  memberRow: { flexDirection: 'row', gap: 6 },
  member: { alignItems: 'center' },
  memberWaiting: { opacity: 0.55 },
  memberMark: {
    position: 'absolute',
    right: -4,
    bottom: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  memberDone: { backgroundColor: colors.gold, borderColor: colors.ink },
  memberPending: { backgroundColor: colors.surface, borderColor: colors.lineStrong },
  memberMarkText: { color: colors.ink, fontSize: 9, lineHeight: 11, fontWeight: '900' },
  memberMarkPending: { color: colors.textMuted },
  memberCount: { color: colors.goldSoft, fontSize: 9.5, fontWeight: '900', letterSpacing: 0.8 },
});
