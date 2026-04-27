export const colors = {
  bg: '#0B0F1A',
  bgSecondary: '#0F1525',
  card: '#141B2D',
  cardLight: '#1E2741',
  cardBorder: '#263354',
  primary: '#00C896',
  primaryDark: '#009970',
  primaryGlow: 'rgba(0,200,150,0.15)',
  secondary: '#F0B90B',
  secondaryGlow: 'rgba(240,185,11,0.15)',
  danger: '#FF4757',
  dangerGlow: 'rgba(255,71,87,0.15)',
  warning: '#FF9F43',
  blue: '#4ECDC4',
  purple: '#A855F7',
  text: '#FFFFFF',
  textSub: '#8892B0',
  textDim: '#4A5568',
  border: '#1E2741',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
  gradientStart: '#0B0F1A',
  gradientEnd: '#141B2D',
};

export const gradients = {
  primary: ['#00C896', '#009970'],
  gold: ['#F0B90B', '#C89A08'],
  dark: ['#141B2D', '#0B0F1A'],
  card: ['#1E2741', '#141B2D'],
  danger: ['#FF4757', '#CC3344'],
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  strong: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 16,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const typography = {
  h1: { fontSize: 28, fontWeight: '700', color: colors.text },
  h2: { fontSize: 22, fontWeight: '700', color: colors.text },
  h3: { fontSize: 18, fontWeight: '600', color: colors.text },
  h4: { fontSize: 15, fontWeight: '600', color: colors.text },
  body: { fontSize: 14, fontWeight: '400', color: colors.text },
  bodySmall: { fontSize: 12, fontWeight: '400', color: colors.textSub },
  caption: { fontSize: 11, fontWeight: '400', color: colors.textDim },
  mono: { fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] },
};
