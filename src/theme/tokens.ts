// src/theme/tokens.ts
// Design tokens — single source of truth, ported from oxxito.css (design handoff).
// Conoxxo palette: red, yellow and blue taken from the Conoxxo logo.

export const colors = {
  oxRed: '#E30613',
  oxRedDark: '#B5000F',
  oxOrange: '#F6B800', // logo yellow (kept the old name; used as accent)
  oxGold: '#F6B800',
  oxBlue: '#005AAE',
  ink: '#241A17',
  ink2: '#6E605B',
  ink3: '#A2948D',
  bg: '#FBF6F2',
  card: '#FFFFFF',
  line: '#EFE5DE',
  line2: '#E6D9D0',
  cream: '#FCEFE0',
  field: '#F5EEE8',
  ok: '#2E9E6B',
  white: '#FFFFFF',
};

// Gradient stop arrays for expo-linear-gradient (colors, locations, angle handled via start/end points)
export const gradients = {
  // Logo red, a little deeper at the start and warmer at the end.
  oxGrad: {
    colors: ['#C8000F', '#E30613', '#F2412A'] as const,
    locations: [0, 0.52, 1] as const,
    start: { x: 0.1, y: 0 },
    end: { x: 0.85, y: 1 },
  },
  // Welcome hero (same reds, near identical angle)
  oxGradHero: {
    colors: ['#C8000F', '#E30613', '#F2412A'] as const,
    locations: [0, 0.5, 1] as const,
    start: { x: 0.08, y: 0 },
    end: { x: 0.86, y: 1 },
  },
  oxGradSoft: {
    colors: ['#FFF3EF', '#FFE5DE'] as const,
    start: { x: 0.1, y: 0 },
    end: { x: 0.85, y: 1 },
  },
  // category accent gradients (icons)
  blue: { colors: ['#005AAE', '#2B7FD4'] as const, start: { x: 0.1, y: 0 }, end: { x: 0.85, y: 1 } },
  green: { colors: ['#2E9E6B', '#46B883'] as const, start: { x: 0.1, y: 0 }, end: { x: 0.85, y: 1 } },
  purple: { colors: ['#8A4FD8', '#A875E8'] as const, start: { x: 0.1, y: 0 }, end: { x: 0.85, y: 1 } },
  dark: { colors: ['#34324A', '#5A5570'] as const, start: { x: 0.1, y: 0 }, end: { x: 0.85, y: 1 } },
  alertRed: { colors: ['#E0453B', '#FF6A4D'] as const, start: { x: 0.1, y: 0 }, end: { x: 0.85, y: 1 } },
  // Splash background: light, so the logo's red sign stands out.
  splash: {
    colors: ['#FFFFFF', '#FFFAEC', '#FFF1CC'] as const,
    locations: [0, 0.52, 1] as const,
    start: { x: 0.05, y: 0 },
    end: { x: 0.9, y: 1 },
  },
};

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  pill: 999,
  hero: 40, // hero bottom corners
  sheet: 30,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
};

export const fontFamily = {
  regular: 'PlusJakartaSans_500Medium',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
};

export const type = {
  // Display/title 27-44px / 800 / letter-spacing -.02em
  display: { fontFamily: fontFamily.extrabold, fontSize: 30, letterSpacing: -0.6, lineHeight: 34 },
  title: { fontFamily: fontFamily.extrabold, fontSize: 28, letterSpacing: -0.5, lineHeight: 31 },
  // Section eyebrow 12-13px / 700 / uppercase / letter-spacing .07-.1em
  eyebrow: { fontFamily: fontFamily.bold, fontSize: 13, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  eyebrowSm: { fontFamily: fontFamily.bold, fontSize: 12, letterSpacing: 1.2, textTransform: 'uppercase' as const },
  // Body 14-15px / 500 / line-height ~1.5
  body: { fontFamily: fontFamily.medium, fontSize: 15.5, lineHeight: 23 },
  bodySm: { fontFamily: fontFamily.medium, fontSize: 14, lineHeight: 21 },
  // Caption/meta 11.5-12.5px
  caption: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 19 },
  label: { fontFamily: fontFamily.bold, fontSize: 13.5 },
  button: { fontFamily: fontFamily.bold, fontSize: 16.5, letterSpacing: 0.1 },
};

export const shadows = {
  card: {
    shadowColor: 'rgba(36,26,23,1)',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  button: {
    shadowColor: 'rgba(227,6,19,1)',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  hero: {
    shadowColor: 'rgba(227,6,19,1)',
    shadowOpacity: 0.55,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 20 },
    elevation: 10,
  },
  chip: {
    shadowColor: 'rgba(120,30,8,1)',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  sheet: {
    shadowColor: 'rgba(0,0,0,1)',
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: -10 },
    elevation: 12,
  },
};

export const minTapTarget = 44;
