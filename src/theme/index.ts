// east3 Design System — Colors, Typography, Spacing
// Brand palette: #088395, #7AB2B2, #EBF4F6, #09637E

export const Colors = {
  // Brand Primary
  primary: '#088395',
  primaryDark: '#09637E',
  primaryLight: '#7AB2B2',
  primarySurface: '#EBF4F6',

  // Dark Background Surfaces
  background: '#070F14',
  surface: '#0D1E27',
  surfaceElevated: '#132633',
  surfaceBorder: '#1E3A4A',

  // Text
  textPrimary: '#EBF4F6',
  textSecondary: '#7AB2B2',
  textMuted: '#3D6B7A',
  textInverse: '#070F14',

  // Status colors
  success: '#22C55E',
  successBg: '#0A2E1A',
  warning: '#F59E0B',
  warningBg: '#2C1F06',
  danger: '#EF4444',
  dangerBg: '#2C0A0A',
  info: '#088395',
  infoBg: '#051520',

  // Category colors for Finance
  categoryFood: '#F59E0B',
  categoryTransport: '#3B82F6',
  categoryShopping: '#A855F7',
  categoryHealth: '#22C55E',
  categoryEntertainment: '#EC4899',
  categoryOther: '#6B7280',

  // Workout split colors
  splitPush: '#EF4444',
  splitPull: '#3B82F6',
  splitLegs: '#22C55E',
  splitFull: '#A855F7',

  // Transparent overlays
  overlay: 'rgba(7, 15, 20, 0.85)',
  glassBg: 'rgba(13, 30, 39, 0.7)',
  glassBorder: 'rgba(122, 178, 178, 0.15)',
} as const;

export const Typography = {
  // Font families (loaded via expo-font)
  fontFamily: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semiBold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    mono: 'SpaceMono_400Regular',
  },

  // Font sizes
  size: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 34,
    '5xl': 42,
  },

  // Line heights
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
  '5xl': 64,
} as const;

export const BorderRadius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  '2xl': 24,
  full: 9999,
} as const;

export const Shadows = {
  sm: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

// Finance categories (consistent with DB)
export const FINANCE_CATEGORIES = [
  { id: 'food', label: 'Makan & Minum', icon: '🍽️', color: '#F59E0B' },
  { id: 'transport', label: 'Transportasi', icon: '🚗', color: '#3B82F6' },
  { id: 'shopping', label: 'Belanja', icon: '🛍️', color: '#A855F7' },
  { id: 'health', label: 'Kesehatan', icon: '💊', color: '#22C55E' },
  { id: 'entertainment', label: 'Hiburan', icon: '🎬', color: '#EC4899' },
  { id: 'education', label: 'Pendidikan', icon: '📚', color: '#06B6D4' },
  { id: 'utilities', label: 'Tagihan', icon: '💡', color: '#84CC16' },
  { id: 'gym', label: 'Gym & Sport', icon: '💪', color: '#F97316' },
  { id: 'investment', label: 'Investasi', icon: '📈', color: '#10B981' },
  { id: 'salary', label: 'Gaji', icon: '💰', color: '#22C55E' },
  { id: 'freelance', label: 'Freelance', icon: '💻', color: '#3B82F6' },
  { id: 'other', label: 'Lainnya', icon: '📦', color: '#6B7280' },
] as const;

export type FinanceCategoryId = typeof FINANCE_CATEGORIES[number]['id'];
