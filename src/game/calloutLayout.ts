// Medidas do aviso de truco para o espaço disponível. Puro, para ser testado sem React Native:
// garante que medalhão, textos e escada caibam na plaquinha em qualquer tamanho de palco.

export interface CalloutLayout {
  /** true: medalhão ao lado do texto; false: medalhão em cima, texto embaixo (palco estreito). */
  row: boolean;
  plaque: { w: number; h: number };
  /** Folga interna (vertical) da plaquinha. */
  pad: number;
  /** Diâmetro do medalhão com o valor; 0 quando não cabe (palco muito baixo). */
  medal: number;
  titleSize: number;
  /** Tamanho da linha de cima ("BIA PEDE"); null quando não cabe. */
  kickerSize: number | null;
  /** Lado do losango da escada da aposta; null quando não cabe. */
  ladder: number | null;
  /** Largura disponível para os textos. */
  textW: number;
}

/** Largura média de um caractere do título (Playfair Black, maiúsculas), em relação ao tamanho da fonte. */
const CHAR = 0.8;
const PAD_X = 10;
const GAP_ROW = 12;
const GAP_STACK = 3;
/** Menor medalhão que ainda lê bem o número; abaixo disso ele some. */
const MIN_MEDAL = 30;

/** Altura ocupada pelas linhas de texto (linha de cima, título e escada). */
export function textBlockHeight(titleSize: number, kickerSize: number | null, ladder: number | null): number {
  return titleSize * 1.18 + (kickerSize ? kickerSize * 1.3 + 2 : 0) + (ladder ? ladder + 6 : 0);
}

export function calloutLayout(width: number, height: number, title: string, large: boolean): CalloutLayout {
  const plaqueH = Math.min(height, large ? 116 : 84);
  const pad = plaqueH >= 80 ? 9 : 6;
  const inner = plaqueH - 2 * pad;
  const len = Math.max(1, title.length);
  const ladderSize = large ? 8 : 6;

  // Em linha: medalhão da altura da plaquinha, texto ao lado.
  const rowW = Math.min(width, plaqueH * 3.4);
  const rowMedal = inner;
  const rowTextW = rowW - 2 * PAD_X - GAP_ROW - rowMedal;
  let rowTitle = Math.min(rowMedal * 0.5, rowTextW / (CHAR * len), large ? 40 : 30);
  let rowKicker: number | null = Math.max(10, Math.min(large ? 14 : 12, rowTitle * 0.42));
  let rowLadder: number | null = ladderSize;
  // Tira primeiro a escada, depois a linha de cima; só então diminui o título.
  if (textBlockHeight(rowTitle, rowKicker, rowLadder) > inner) rowLadder = null;
  if (textBlockHeight(rowTitle, rowKicker, rowLadder) > inner) rowKicker = null;
  if (textBlockHeight(rowTitle, rowKicker, rowLadder) > inner) rowTitle = inner / 1.18;
  if (rowTextW >= 56 && rowTitle >= (large ? 18 : 15)) {
    return {
      row: true,
      plaque: { w: rowW, h: plaqueH },
      pad,
      medal: rowMedal,
      titleSize: rowTitle,
      kickerSize: rowKicker,
      ladder: rowLadder,
      textW: rowTextW,
    };
  }

  // Empilhado: título na largura toda, medalhão com o que sobrar da altura.
  const textW = width - 2 * 6;
  let title_ = Math.max(13, Math.min(textW / (CHAR * len), large ? 28 : 22));
  let kicker: number | null = plaqueH >= 96 ? 10 : null;
  let ladder: number | null = ladderSize;
  const medalFor = () => Math.min(width * 0.46, inner - GAP_STACK - textBlockHeight(title_, kicker, ladder));
  if (medalFor() < MIN_MEDAL) kicker = null;
  if (medalFor() >= MIN_MEDAL) {
    return { row: false, plaque: { w: width, h: plaqueH }, pad, medal: medalFor(), titleSize: title_, kickerSize: kicker, ladder, textW };
  }
  // Palco muito baixo: sem medalhão (ele ficaria minúsculo). O título já diz o pedido ("SEIS!") e a
  // escada mostra o degrau; o título só encolhe se nem assim couber.
  if (textBlockHeight(title_, null, ladder) > inner) ladder = null;
  if (textBlockHeight(title_, null, ladder) > inner) title_ = Math.max(12, inner / 1.18);
  return { row: false, plaque: { w: width, h: plaqueH }, pad, medal: 0, titleSize: title_, kickerSize: null, ladder, textW };
}
