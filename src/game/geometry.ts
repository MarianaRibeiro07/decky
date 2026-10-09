// Geometria da mesa: onde ficam os quatro lugares, as cartas jogadas, o baralho e a vira.
// Pura (sem React Native) para ser testada e para a animação de distribuição usar
// exatamente as mesmas posições que a mesa desenha.
import { superellipseDepth } from '../ui/shapes';
import type { Side } from './describe';

export const CARD_RATIO = 726 / 500;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TableVariant = 'compact' | 'large';

/** Disposição interna da etiqueta: em linha (avatar ao lado do nome) ou em coluna (avatar em cima). */
export type ChipLayout = 'row' | 'column';

export interface TableGeometry {
  card: { w: number; h: number };
  /** Etiqueta de cada lugar (avatar, nome, dupla, cartas na mão). */
  chips: Record<Side, Rect>;
  /** Em cima e embaixo as etiquetas são largas (em linha); nas laterais, estreitas e altas (em coluna). */
  chipLayout: Record<Side, ChipLayout>;
  /** false quando a etiqueta de baixo não é desenhada (o próprio jogador, com a mão logo abaixo). */
  bottomChipVisible: boolean;
  /** Onde cai a carta jogada por cada lugar. */
  played: Record<Side, Rect>;
  deck: Rect;
  vira: Rect;
  /** Selo da manilha: sobre a parte de baixo do baralho, à esquerda da vira, sem tocar em carta jogada. */
  manilha: Rect;
  /**
   * Palco do centro: o espaço livre entre as quatro cartas jogadas (onde ficam baralho e vira).
   * Os avisos de truco aparecem aqui, sem cobrir carta jogada nem nome de jogador.
   */
  stage: Rect;
}

const SIDES: Side[] = ['bottom', 'right', 'top', 'left'];

export const center = (r: Rect) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

interface Extra {
  top: number;
  bottom: number;
  side: number;
}

/**
 * Calcula a mesa para uma área de `width` x `height`.
 * 'compact' é a metade de cima da tela do jogador: o lugar de baixo é ele mesmo e não leva etiqueta.
 * 'large' é o celular dedicado à mesa: os quatro lugares têm etiqueta.
 * O tamanho da carta sai do menor dos limites (altura e largura), então nada se sobrepõe.
 *
 * `shape`: expoente da superelipse do feltro inscrita na área (a mesa não é retangular). Com ele, o que
 * fica perto da curva (as etiquetas de cima e de baixo, as colunas laterais) é recuado até ficar inteiro
 * dentro do feltro, com a mesma folga das bordas retas. Sem ele, a área é tratada como retângulo.
 */
export function tableGeometry(width: number, height: number, variant: TableVariant, shape: number | null = null): TableGeometry {
  let extra: Extra = { top: 0, bottom: 0, side: 0 };
  let g = layout(width, height, variant, extra);
  if (shape === null) return g;
  // O recuo depende da largura das etiquetas e do tamanho das cartas, que dependem do recuo:
  // poucas rodadas bastam para estabilizar (cada uma só aumenta o recuo).
  for (let i = 0; i < 6; i++) {
    const need = curveInsets(g, width, height, shape);
    if (need.top <= extra.top + 0.25 && need.bottom <= extra.bottom + 0.25 && need.side <= extra.side + 0.25) break;
    extra = {
      top: Math.max(extra.top, need.top),
      bottom: Math.max(extra.bottom, need.bottom),
      side: Math.max(extra.side, need.side),
    };
    g = layout(width, height, variant, extra);
  }
  return g;
}

/** Folgas e medidas de cada variante. */
function metrics(variant: TableVariant, height: number) {
  const large = variant === 'large';
  return {
    large,
    pad: large ? 10 : 6,
    gap: large ? 10 : 6,
    // Em cima e embaixo: avatar ao lado do nome. Na mesa dedicada baixa (celular pequeno), um pouco
    // mais baixas, para sobrar altura para as cartas.
    endChipH: large ? (height < 440 ? 48 : 58) : 38,
    // Laterais: avatar em cima, nome e dupla embaixo. A altura se adapta ao espaço da coluna:
    // no máximo, dupla e cartas em linhas próprias; no mínimo, numa linha só (sem as cartinhas).
    sideChipMax: large ? 96 : 60,
    sideChipMin: large ? 62 : 56,
    centerScale: large ? 0.85 : 0.8,
  };
}

function layout(width: number, height: number, variant: TableVariant, extra: Extra): TableGeometry {
  const { large, pad, gap, endChipH, sideChipMax, sideChipMin, centerScale } = metrics(variant, height);
  const bottomChipVisible = large;
  const padTop = pad + extra.top;
  const padBottom = pad + extra.bottom;
  const padSide = pad + extra.side;
  const sideChipW = Math.min(width * 0.25, large ? 150 : 100);
  const endChipW = Math.min(width * (large ? 0.56 : 0.5), large ? 260 : 200);

  // Na vertical cabem: etiqueta, carta de cima, centro (baralho e vira), carta de baixo e, na mesa, a etiqueta de baixo.
  const chipsHigh = bottomChipVisible ? 2 : 1;
  const cardHFromHeight = (height - padTop - padBottom - chipsHigh * endChipH - (chipsHigh + 2) * gap) / (2 + centerScale);
  // Na horizontal: coluna esquerda, baralho + vira, coluna direita.
  const cardWFromWidth = (width - 2 * padSide - 2 * sideChipW - 3 * gap) / (2 * centerScale);
  // A coluna lateral (etiqueta + carta) cabe entre as etiquetas de cima e de baixo, com a etiqueta no mínimo.
  const columnSpace = height - padTop - padBottom - endChipH - gap - (bottomChipVisible ? endChipH + gap : 0);
  const cardHFromColumn = columnSpace - gap - sideChipMin;
  const cardW = Math.max(
    28,
    Math.min(cardHFromHeight / CARD_RATIO, cardHFromColumn / CARD_RATIO, cardWFromWidth, sideChipW, large ? 150 : 84),
  );
  const cardH = cardW * CARD_RATIO;
  const sideChipH = Math.max(sideChipMin, Math.min(sideChipMax, columnSpace - gap - cardH));

  const midX = width / 2;
  const topPlayedY = padTop + endChipH + gap;
  const bottomPlayedY = height - padBottom - (bottomChipVisible ? endChipH + gap : 0) - cardH;
  // O centro fica no meio do espaço entre a carta de cima e a de baixo.
  const midY = (topPlayedY + cardH + bottomPlayedY) / 2;
  // Colunas laterais (etiqueta + carta) centradas no meio, sem invadir a faixa das etiquetas de cima e de baixo.
  const columnH = sideChipH + gap + cardH;
  const columnMin = padTop + endChipH + gap;
  const columnMax = height - padBottom - (bottomChipVisible ? endChipH + gap : 0) - columnH;
  const columnTop = Math.max(columnMin, Math.min(midY - columnH / 2, columnMax));
  const leftX = padSide;
  const rightX = width - padSide - sideChipW;

  const chips: Record<Side, Rect> = {
    top: { x: midX - endChipW / 2, y: padTop, w: endChipW, h: endChipH },
    // Sem etiqueta visível, o retângulo ainda serve de referência para a distribuição (cartas indo para a mão).
    bottom: { x: midX - endChipW / 2, y: height - padBottom - endChipH, w: endChipW, h: endChipH },
    left: { x: leftX, y: columnTop, w: sideChipW, h: sideChipH },
    right: { x: rightX, y: columnTop, w: sideChipW, h: sideChipH },
  };

  const played: Record<Side, Rect> = {
    top: { x: midX - cardW / 2, y: topPlayedY, w: cardW, h: cardH },
    bottom: { x: midX - cardW / 2, y: bottomPlayedY, w: cardW, h: cardH },
    left: { x: leftX + (sideChipW - cardW) / 2, y: columnTop + sideChipH + gap, w: cardW, h: cardH },
    right: { x: rightX + (sideChipW - cardW) / 2, y: columnTop + sideChipH + gap, w: cardW, h: cardH },
  };

  const cw = cardW * centerScale;
  const ch = cw * CARD_RATIO;
  const deck = { x: midX - gap / 2 - cw, y: midY - ch / 2, w: cw, h: ch };
  const manilhaX = leftX + sideChipW + gap;
  const manilhaH = Math.min(ch * 0.62, large ? 48 : 36);

  const stageX = leftX + sideChipW + gap;
  const stageTop = topPlayedY + cardH + gap;
  const stage = { x: stageX, y: stageTop, w: width - 2 * stageX, h: Math.max(0, bottomPlayedY - gap - stageTop) };

  return {
    card: { w: cardW, h: cardH },
    chips,
    chipLayout: { top: 'row', bottom: 'row', left: 'column', right: 'column' },
    bottomChipVisible,
    played,
    deck,
    vira: { x: midX + gap / 2, y: midY - ch / 2, w: cw, h: ch },
    manilha: { x: manilhaX, y: deck.y + ch - manilhaH - 2, w: deck.x + cw - manilhaX, h: manilhaH },
    stage,
  };
}

/**
 * Recuo extra que cada borda precisa para os cantos das caixas mais externas ficarem dentro da curva,
 * com a mesma folga (`pad`) que as bordas retas têm.
 */
function curveInsets(g: TableGeometry, width: number, height: number, n: number): Extra {
  // As caixas já ficam a `pad` da borda reta; o recuo extra é só a profundidade da curva sob os cantos.
  const halfW = width / 2;
  const halfH = height / 2;
  // Profundidade da curva em cima/embaixo na coluna x, e nas laterais na linha y.
  const depthAtX = (x: number) => superellipseDepth((x - halfW) / halfW, halfH, n);
  const depthAtY = (y: number) => superellipseDepth((y - halfH) / halfH, halfW, n);
  const edgeDepthX = (r: Rect) => Math.max(depthAtX(r.x), depthAtX(r.x + r.w));
  const edgeDepthY = (r: Rect) => Math.max(depthAtY(r.y), depthAtY(r.y + r.h));

  // A caixa mais alta encosta na borda de cima; embaixo, a etiqueta (mesa) ou a carta do jogador (compacta).
  const bottomBox = g.bottomChipVisible ? g.chips.bottom : g.played.bottom;
  const top = edgeDepthX(g.chips.top);
  const bottom = edgeDepthX(bottomBox);
  // Nas laterais, a etiqueta encosta na borda e a carta fica centrada na coluna (já tem um recuo próprio).
  const columnX = g.chips.left.x;
  const side = Math.max(edgeDepthY(g.chips.left), edgeDepthY(g.played.left) - (g.played.left.x - columnX));
  return { top, bottom, side };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Caixas desenhadas na mesa que não podem encostar umas nas outras (lugares e cartas). */
export function geometryRects(g: TableGeometry): Rect[] {
  const chipSides = SIDES.filter((s) => s !== 'bottom' || g.bottomChipVisible);
  return [...chipSides.map((s) => g.chips[s]), ...SIDES.map((s) => g.played[s]), g.deck, g.vira];
}

export function hasOverlap(g: TableGeometry): boolean {
  const rects = geometryRects(g);
  if (rects.some((a, i) => rects.some((b, j) => j > i && overlaps(a, b)))) return true;
  // O selo fica de propósito sobre o baralho; com o resto, não pode encostar.
  if (rects.filter((r) => r !== g.deck).some((r) => overlaps(r, g.manilha))) return true;
  // O palco (avisos de truco) pode cobrir baralho, vira e selo, mas nunca etiqueta ou carta jogada.
  const chipSides = SIDES.filter((s) => s !== 'bottom' || g.bottomChipVisible);
  return [...chipSides.map((s) => g.chips[s]), ...SIDES.map((s) => g.played[s])].some((r) => overlaps(r, g.stage));
}
