// Geometria da mesa: onde ficam os quatro lugares, as cartas jogadas, o baralho e a vira.
// Pura (sem React Native) para ser testada e para a animação de distribuição usar
// exatamente as mesmas posições que a mesa desenha.
import type { Side } from './describe';

export const CARD_RATIO = 726 / 500;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TableVariant = 'compact' | 'large';

export interface TableGeometry {
  card: { w: number; h: number };
  /** Etiqueta de cada lugar (nome, dupla, cartas na mão). */
  chips: Record<Side, Rect>;
  /** false quando a etiqueta de baixo não é desenhada (o próprio jogador, com a mão logo abaixo). */
  bottomChipVisible: boolean;
  /** Onde cai a carta jogada por cada lugar. */
  played: Record<Side, Rect>;
  deck: Rect;
  vira: Rect;
  /** Selo da manilha: sobre a parte de baixo do baralho, à esquerda da vira, sem tocar em carta jogada. */
  manilha: Rect;
}

const SIDES: Side[] = ['bottom', 'right', 'top', 'left'];

export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/**
 * Calcula a mesa para uma área de `width` x `height`.
 * 'compact' é a metade de cima da tela do jogador: o lugar de baixo é ele mesmo e não leva etiqueta.
 * 'large' é o celular dedicado à mesa: os quatro lugares têm etiqueta.
 * O tamanho da carta sai do menor dos limites (altura e largura), então nada se sobrepõe.
 */
export function tableGeometry(width: number, height: number, variant: TableVariant): TableGeometry {
  const large = variant === 'large';
  const bottomChipVisible = large;
  const pad = large ? 12 : 6;
  const gap = large ? 10 : 6;
  // Na mesa dedicada as etiquetas laterais são estreitas e usam três linhas (nome, dupla, cartas).
  const chipH = large ? 68 : 40;
  const sideChipW = Math.min(width * 0.25, large ? 150 : 100);
  const endChipW = Math.min(width * 0.6, large ? 280 : 210);
  const centerScale = large ? 0.85 : 0.8;

  // Na vertical cabem: etiqueta, carta de cima, centro (baralho e vira), carta de baixo e, na mesa, a etiqueta de baixo.
  const chipsHigh = bottomChipVisible ? 2 : 1;
  const cardHFromHeight = (height - 2 * pad - chipsHigh * chipH - (chipsHigh + 2) * gap) / (2 + centerScale);
  // Na horizontal: coluna esquerda, baralho + vira, coluna direita.
  const cardWFromWidth = (width - 2 * pad - 2 * sideChipW - 3 * gap) / (2 * centerScale);
  const cardW = Math.max(28, Math.min(cardHFromHeight / CARD_RATIO, cardWFromWidth, sideChipW, large ? 150 : 84));
  const cardH = cardW * CARD_RATIO;

  const midX = width / 2;
  const topPlayedY = pad + chipH + gap;
  const bottomPlayedY = height - pad - (bottomChipVisible ? chipH + gap : 0) - cardH;
  // O centro fica no meio do espaço entre a carta de cima e a de baixo.
  const midY = (topPlayedY + cardH + bottomPlayedY) / 2;
  const columnTop = midY - (chipH + gap + cardH) / 2;

  const chips: Record<Side, Rect> = {
    top: { x: midX - endChipW / 2, y: pad, w: endChipW, h: chipH },
    // Sem etiqueta visível, o retângulo ainda serve de referência para a fala ("TRUCO!") do jogador.
    bottom: { x: midX - endChipW / 2, y: height - pad - chipH, w: endChipW, h: chipH },
    left: { x: pad, y: columnTop, w: sideChipW, h: chipH },
    right: { x: width - pad - sideChipW, y: columnTop, w: sideChipW, h: chipH },
  };

  const played: Record<Side, Rect> = {
    top: { x: midX - cardW / 2, y: topPlayedY, w: cardW, h: cardH },
    bottom: { x: midX - cardW / 2, y: bottomPlayedY, w: cardW, h: cardH },
    left: { x: pad + (sideChipW - cardW) / 2, y: columnTop + chipH + gap, w: cardW, h: cardH },
    right: { x: width - pad - sideChipW + (sideChipW - cardW) / 2, y: columnTop + chipH + gap, w: cardW, h: cardH },
  };

  const cw = cardW * centerScale;
  const ch = cw * CARD_RATIO;
  const deck = { x: midX - gap / 2 - cw, y: midY - ch / 2, w: cw, h: ch };
  const manilhaX = pad + sideChipW + gap;
  const manilhaH = Math.min(ch * 0.62, large ? 48 : 36);
  return {
    card: { w: cardW, h: cardH },
    chips,
    bottomChipVisible,
    played,
    deck,
    vira: { x: midX + gap / 2, y: midY - ch / 2, w: cw, h: ch },
    manilha: { x: manilhaX, y: deck.y + ch - manilhaH - 2, w: deck.x + cw - manilhaX, h: manilhaH },
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Todas as caixas desenhadas na mesa, para conferir em teste que nenhuma se sobrepõe. */
export function geometryRects(g: TableGeometry): Rect[] {
  const chipSides = SIDES.filter((s) => s !== 'bottom' || g.bottomChipVisible);
  return [...chipSides.map((s) => g.chips[s]), ...SIDES.map((s) => g.played[s]), g.deck, g.vira];
}

export function hasOverlap(g: TableGeometry): boolean {
  const rects = geometryRects(g);
  if (rects.some((a, i) => rects.some((b, j) => j > i && overlaps(a, b)))) return true;
  // O selo fica de propósito sobre o baralho; com o resto, não pode encostar.
  return rects.filter((r) => r !== g.deck).some((r) => overlaps(r, g.manilha));
}
