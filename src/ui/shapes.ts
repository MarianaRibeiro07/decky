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
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function insetBox(b: Box, d: number): Box {
  return { x: b.x + d, y: b.y + d, w: Math.max(0, b.w - 2 * d), h: Math.max(0, b.h - 2 * d) };
}

/**
 * Medidas da mesa para uma área de `width` x `height`.
 * O aro tira espaço das cartas, então ele é fino na mesa compacta (celular pequeno, metade da tela)
 * e o conteúdo pode encostar no trilho: as etiquetas dos lugares ficam sobre a borda, como plaquinhas.
 */
export function surfaceMetrics(width: number, height: number, variant: SurfaceVariant): SurfaceMetrics {
  const min = Math.min(width, height);
  const tableRim = clamp(min * 0.045, 12, 28);
  // `overlap`: quanto o conteúdo avança além do feltro. Na mesa dedicada só as plaquinhas encostam nas
  // bordas (as cartas têm recuo próprio na geometria), então ele vai até o meio do couro: as plaquinhas
  // ficam sobre o aro, onde cada um senta, e sobra mais espaço para as cartas.
  const cfg =
    variant === 'table'
      ? { margin: 2, apron: clamp(min * 0.022, 6, 14), rim: tableRim, rail: 3, n: 3.4, overlap: 3 + tableRim / 2 }
      : variant === 'compact'
        ? { margin: 1, apron: 4, rim: clamp(min * 0.03, 7, 12), rail: 2, n: 3.6, overlap: 4 }
        : { margin: 0, apron: 4, rim: 8, rail: 2, n: 8, overlap: 0 };

  const top: Box = {
    x: cfg.margin,
    y: cfg.margin,
    w: Math.max(0, width - 2 * cfg.margin),
    h: Math.max(0, height - 2 * cfg.margin - cfg.apron),
  };
  const felt = insetBox(top, cfg.rim + cfg.rail);
  const content = insetBox(felt, -cfg.overlap);
  return { top, apron: cfg.apron, rim: cfg.rim, rail: cfg.rail, felt, content, n: cfg.n };
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
