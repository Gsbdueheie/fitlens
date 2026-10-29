import { useColorScheme } from 'react-native';

/**
 * FitLens 设计系统。
 * 目标视觉：专业、清爽、有运动感。以祖母绿为主色（活力/健康），
 * 琥珀色用于「运动消耗」，三大营养素用固定的分类色（蓝/琥珀/玫红），
 * 状态色仅用于成功/警告/危险，不与分类色混用。
 */

export const brand = {
  primary: '#0E9F6E',
  primaryDeep: '#0B7A55',
  onPrimary: '#FFFFFF',
  primarySoft: '#E4F6EE',
} as const;

// 三大营养素分类色（固定顺序：蛋白质 / 碳水 / 脂肪）
export const macros = {
  protein: '#2E6FDB', // 蓝
  carbs: '#E08A00', // 琥珀
  fat: '#C2417C', // 玫红
} as const;

export const statusColors = {
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
} as const;

// 运动消耗 / 能量强调色
export const energy = {
  main: '#F59E0B',
  soft: '#FEF3C7',
} as const;

export const lightColors = {
  background: '#F5F7F6',
  surface: '#FFFFFF',
  surfaceAlt: '#EDF0EE',
  border: '#E3E7E4',
  text: '#14211B',
  textSecondary: '#5A6761',
  textMuted: '#8A948E',
  tabInactive: '#98A39D',
  ...brand,
  ...macros,
  ...statusColors,
  ...energy,
} as const;

export const darkColors: AppColors = {
  background: '#0D1411',
  surface: '#16211C',
  surfaceAlt: '#1F2C26',
  border: '#2A3831',
  text: '#EAF2EE',
  textSecondary: '#A8B5AE',
  textMuted: '#76837C',
  tabInactive: '#5C6A62',
  ...brand,
  ...macros,
  ...statusColors,
  ...energy,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 30,
  hero: 40,
} as const;

export type AppColors = { [K in keyof typeof lightColors]: string };

export function useTheme(): { dark: boolean; colors: AppColors } {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  return { dark, colors: dark ? darkColors : lightColors };
}
