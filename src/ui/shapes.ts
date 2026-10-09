// Formato da mesa física: superelipse (oval "cheio", como as mesas profissionais de cartas),
// com aro de couro, trilho metálico, feltro e a lateral visível embaixo (espessura do tampo).
// Puro (sem React Native) para ser testado e para a mesa e o conteúdo usarem as mesmas medidas.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 'table': mesa do jogo; 'compact': mesa na metade de cima do jogador; 'panel': bandeja de feltro (HUD, lobby). */
export type SurfaceVariant = 'table' | 'compact' | 'panel';

export interface SurfaceMetrics {
  /** Tampo inteiro (borda externa do aro). */
  top: Box;
  /** Espessura da lateral desenhada abaixo do tampo. */
  apron: number;
  rim: number;
  rail: number;
  /** Área de feltro (dentro do trilho). */
  felt: Box;
  /** Onde o conteúdo (lugares, cartas) é posicionado. */
  content: Box;
  /** Expoente da superelipse: 2 = elipse; quanto maior, mais perto de um retângulo arredondado. */
  n: number;
  /**
   * Raio dos cantos do tampo quando o formato é um retângulo arredondado (bandeja 'panel'); null = superelipse.
   * A curva da superelipse fica mais funda quanto maior a caixa, então um recuo fixo do conteúdo não
   * bastava na bandeja: em telas maiores os cantos dos lugares do lobby passavam por cima do aro.
   * Com raio fixo, o recuo do conteúdo vale em qualquer tamanho.
   */
  corner: number | null;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function insetBox(b: Box, d: number): Box {
  return { x: b.x + d, y: b.y + d, w: Math.max(0, b.w - 2 * d), h: Math.max(0, b.h - 2 * d) };
}

/**
 * Medidas da mesa para uma área de `width` x `height`.
 * O aro tira espaço das cartas, então ele é fino na mesa compacta (celular pequeno, metade da tela).
 * O conteúdo (lugares, cartas) fica sempre dentro do feltro: a geometria da mesa recua o que estiver
 * perto da curva, para nenhuma etiqueta passar por cima do trilho ou do couro.
 */
export function surfaceMetrics(width: number, height: number, variant: SurfaceVariant): SurfaceMetrics {
  const min = Math.min(width, height);
  const cfg =
    variant === 'table'
      ? { margin: 2, apron: clamp(min * 0.022, 6, 14), rim: clamp(min * 0.04, 11, 24), rail: 3, n: 3.4, corner: null }
      : variant === 'compact'
        ? { margin: 1, apron: 4, rim: clamp(min * 0.026, 6, 10), rail: 2, n: 3.6, corner: null }
        : { margin: 0, apron: 4, rim: 8, rail: 2, n: 8, corner: 22 };

  const top: Box = {
    x: cfg.margin,
    y: cfg.margin,
    w: Math.max(0, width - 2 * cfg.margin),
    h: Math.max(0, height - 2 * cfg.margin - cfg.apron),
  };
  const felt = insetBox(top, cfg.rim + cfg.rail);
  return { top, apron: cfg.apron, rim: cfg.rim, rail: cfg.rail, felt, content: felt, n: cfg.n, corner: cfg.corner };
}

/** Caminho SVG de um retângulo com cantos de raio `r`. */
export function roundedRectPath(b: Box, r: number): string {
  const k = Math.max(0, Math.min(r, b.w / 2, b.h / 2));
  const x2 = b.x + b.w;
  const y2 = b.y + b.h;
  return (
    `M${b.x + k} ${b.y} H${x2 - k} A${k} ${k} 0 0 1 ${x2} ${b.y + k} V${y2 - k} ` +
    `A${k} ${k} 0 0 1 ${x2 - k} ${y2} H${b.x + k} A${k} ${k} 0 0 1 ${b.x} ${y2 - k} V${b.y + k} ` +
    `A${k} ${k} 0 0 1 ${b.x + k} ${b.y} Z`
  );
}

/**
 * Contorno do tampo recuado `inset` para dentro: superelipse na mesa, retângulo arredondado na bandeja.
 * No retângulo, o raio diminui junto com o recuo, para as curvas ficarem paralelas.
 */
export function surfacePath(m: SurfaceMetrics, b: Box, inset: number): string {
  return m.corner === null ? superellipsePath(b, m.n) : roundedRectPath(b, Math.max(2, m.corner - inset));
}

/**
 * Quanto a curva da superelipse se afasta do lado reto da caixa, numa posição ao longo desse lado.
 * `t` é a distância ao meio do lado, normalizada (0 no meio, 1 no canto); `semiAxis` é a metade
 * da caixa na direção perpendicular ao lado. No meio do lado a profundidade é 0; no canto, `semiAxis`.
 */
export function superellipseDepth(t: number, semiAxis: number, n: number): number {
  const u = Math.min(1, Math.abs(t));
  return semiAxis * (1 - (1 - u ** n) ** (1 / n));
}

/** O ponto está dentro da superelipse inscrita em `b`, com folga `margin` das bordas. */
export function insideSuperellipse(p: { x: number; y: number }, b: Box, n: number, margin = 0): boolean {
  const a = b.w / 2 - margin;
  const r = b.h / 2 - margin;
  if (a <= 0 || r <= 0) return false;
  const dx = Math.abs(p.x - (b.x + b.w / 2)) / a;
  const dy = Math.abs(p.y - (b.y + b.h / 2)) / r;
  return dx ** n + dy ** n <= 1 + 1e-6;
}

/** Caminho SVG fechado de uma superelipse inscrita em `b`. */
export function superellipsePath(b: Box, n: number, steps = 120): string {
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const a = b.w / 2;
  const r = b.h / 2;
  const e = 2 / n;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    const x = cx + a * Math.sign(c) * Math.abs(c) ** e;
    const y = cy + r * Math.sign(s) * Math.abs(s) ** e;
    parts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return `${parts.join(' ')} Z`;
}
