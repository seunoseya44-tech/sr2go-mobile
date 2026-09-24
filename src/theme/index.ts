/**
 * Design tokens. Brand colours are taken from shareride2go.com so the app
 * feels continuous with the live web platform.
 */

export const colors = {
  brand: '#0099F9',
  brandPressed: '#0082D6',
  brandSoft: '#E6F5FE',
  navy: '#032C92',
  midnight: '#0A1628',

  background: '#F5F8FC',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  borderFocus: '#0099F9',

  text: '#111827',
  textMuted: '#6B7280',
  textSubtle: '#9CA3AF',
  textOnBrand: '#FFFFFF',

  danger: '#DC2626',
  dangerSoft: '#FEF2F2',
  success: '#16A34A',
  successSoft: '#F0FDF4',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
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
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5 },
  title: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyMedium: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 16 },
  button: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 20 },
} as const;

export const shadow = {
  card: {
    // Cross-platform on the New Architecture (RN 0.76+); replaces shadow*/elevation.
    boxShadow: '0px 6px 16px rgba(10, 22, 40, 0.08)',
  },
} as const;
