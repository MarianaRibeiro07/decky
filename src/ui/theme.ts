// Tokens visuais do Decky: cassino reservado. Preto e grafite dominam; o creme, o vermelho e o
// contorno quase preto vêm do logo; o dourado envelhecido é acento pontual (vez, manilha, vitória).
// Contraste conferido para texto normal (>= 4,5:1) sobre `bg` e `surface` nas combinações usadas.

export const colors = {
  // Base: preto profundo, grafite e carvão.
  bg: '#0A0A0B',
  surface: '#141518',
  surfaceRaised: '#1B1C20',
  surfaceSunken: '#0E0F11',
  line: '#2B2D32',
  lineStrong: '#3D4046',
  metal: '#9A9EA5',
  metalDark: '#55585E',

  // Texto sobre fundo escuro.
  text: '#EFEAE0',
  textMuted: '#ABA79E',
  textFaint: '#8A867E',

  // Cores do logo.
  cream: '#FBF6EC',
  ink: '#16181B',
  red: '#C8102E',
  redDeep: '#8E0B21',
  /** Vermelho do logo clareado para texto sobre fundo escuro. */
  redText: '#F06A7C',

  // Acento premium: usar pouco.
  gold: '#C9A45C',
  goldSoft: '#E3CC98',
  goldDeep: '#6E5630',

  // Mesa: feltro carvão, couro preto.
  felt: '#303236',
  feltEdge: '#141517',
  leather: '#0E0E0F',
  leatherHi: '#3A3B40',

  // Duplas, claras o bastante para ler sobre o preto.
  teamA: '#7EA2DD',
  teamB: '#DE8A57',

  success: '#6CC895',
  successBg: '#0F2419',
  errorBg: '#2B0E14',
  infoBg: '#17191D',
  scrim: '#000000C2',
};

/** Fontes carregadas em app/_layout.tsx. Com fonte própria, não use `fontWeight` (o peso já está no arquivo). */
export const fonts = {
  /** Títulos, nomes de tela e números do placar. */
  display: 'PlayfairDisplay_700Bold',
  displayHeavy: 'PlayfairDisplay_900Black',
};

export const font = {
  tiny: 12,
  small: 15,
  body: 18,
  large: 22,
  title: 28,
  huge: 40,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 8,
  md: 14,
  lg: 22,
};

/**
 * Sombras no formato `boxShadow` (nova arquitetura do React Native, Android e iOS).
 * Poucas e baratas: só cartas, painéis e botões. Cartas voando na distribuição não levam sombra.
 */
export const shadow = {
  card: '0px 2px 3px rgba(0, 0, 0, 0.6)',
  cardLifted: '0px 12px 14px rgba(0, 0, 0, 0.55)',
  panel: '0px 10px 24px rgba(0, 0, 0, 0.55)',
  button: 'inset 0px 1px 0px rgba(255, 255, 255, 0.16), 0px 4px 10px rgba(0, 0, 0, 0.45)',
  turn: '0px 0px 12px rgba(201, 164, 92, 0.45)',
};

/** Alvo mínimo de toque recomendado (44 x 44 pt); usamos mais nos botões principais. */
export const TOUCH_MIN = 48;
