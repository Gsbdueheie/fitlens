import { round } from './util';

/**
 * 单位约定（重要）：
 * 本应用中的「1 卡」按营养学中的「1 千卡（kcal）」计算，
 * 符合日常饮食记录里的口语习惯。程序内部统一用 kcal 存储与计算，
 * 仅在界面显示时把数值标注为「卡」。
 */
export const KCAL_UNIT_NOTE =
  '本应用中的 1 卡按 1 千卡（kcal）计算，符合日常饮食记录中的用法。';

/** 千卡 → 「1,800 卡」 */
export function formatKcal(n: number): string {
  return `${Math.round(n).toLocaleString('zh-CN')} 卡`;
}

/** 紧凑形式：「1800卡」（用于图表/标签） */
export function formatKcalCompact(n: number): string {
  return `${Math.round(n).toLocaleString('zh-CN')}卡`;
}

export function formatInt(n: number): string {
  return Math.round(n).toLocaleString('zh-CN');
}

export function formatDecimal(n: number, digits = 1): string {
  return round(n, digits).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatWeight(kg: number): string {
  return `${formatDecimal(kg, 1)} kg`;
}

export function formatLength(cm: number): string {
  return `${formatDecimal(cm, 1)} cm`;
}

/** 变化幅度：+1.2 / -0.8 / 0，带正负号。 */
export function formatDelta(n: number, digits = 1): string {
  const v = round(n, digits);
  return v > 0 ? `+${formatDecimal(v, digits)}` : `${formatDecimal(v, digits)}`;
}

export function formatPercent(n: number): string {
  return `${round(n * 100, 0)}%`;
}
