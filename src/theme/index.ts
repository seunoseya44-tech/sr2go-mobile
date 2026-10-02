/**
 * Design tokens. Brand palette, type scale and sizes follow the SR2Go Build
 * Brief v1 and Design Review 3 (29 Sep 2026): Primary Blue, Deep Blue, Deep
 * Navy, white; Montserrat for titles/prices/buttons, Inter for everything
 * else; minimum text sizes; no green anywhere.
 */

export const colors = {
  brand: '#0099F9',
  brandPressed: '#0082D6',
  brandSoft: '#E6F5FE',
  navy: '#032C92',
  midnight: '#0A1628',

  background: '#FFFFFF',
  surface: '#FFFFFF',
  tile: '#F1F4F9',
  border: '#E3E9F2',
  borderFocus: '#0099F9',

  text: '#0A1628',
  textMuted: '#4A5568',
  textSubtle: '#8A97A8',
  textOnBrand: '#FFFFFF',

  danger: '#E11D48',
  dangerSoft: '#FFE4E6',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  // Confirmations use blue, never green (brand rule).
  success: '#032C92',
  successSoft: '#E6F5FE',
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  display: 'Montserrat_600SemiBold',
  displayBold: 'Montserrat_700Bold',
  displayLight: 'Montserrat_300Light',
} as const;

/** Minimum sizes from Design Review 3; never go below these on a 390pt frame. */
export const typography = {
  display: { fontFamily: fonts.displayBold, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  softTitle: { fontFamily: fonts.displayLight, fontSize: 30, lineHeight: 38 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 32 },
  heading: { fontFamily: fonts.display, fontSize: 18, lineHeight: 26 },
  price: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  priceSmall: { fontFamily: fonts.displayBold, fontSize: 18, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 23 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 16, lineHeight: 23 },
  bodySemibold: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 23 },
  secondary: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 20 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  overline: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.8 },
  button: { fontFamily: fonts.display, fontSize: 16, lineHeight: 20 },
} as const;

export const shadow = {
  card: {
    // Cross-platform on the New Architecture (RN 0.76+); replaces shadow*/elevation.
    boxShadow: '0px 4px 16px rgba(10, 22, 40, 0.06)',
  },
} as const;

/** Minimum tap target (Design Review 3). */
export const TAP = 44;
