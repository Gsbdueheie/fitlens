export function uid(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  );
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** 对数字四舍五入到指定小数位，避免浮点误差。 */
export function round(n: number, digits = 0): number {
  const f = Math.pow(10, digits);
  return Math.round(n * f) / f;
}

/** 空值安全的有限数字钳制到 [min, max]。 */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
