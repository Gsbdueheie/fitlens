/** 日期工具：统一使用 YYYY-MM-DD（本地时区），避免跨时区错位。 */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

/** 最近 n 天（含 endISO），按升序返回。 */
export function recentDays(n: number, endISO = todayISO()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(endISO, -i));
  return out;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export function weekdayLabel(iso: string): string {
  return `周${WEEKDAYS[parseISO(iso).getDay()]}`;
}

/** 人类可读的日期标签：今天 / 昨天 / M月D日。 */
export function dateLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return '今天';
  if (iso === addDays(today, -1)) return '昨天';
  const d = parseISO(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 用于趋势图横轴的短标签：M/D。 */
export function shortDate(iso: string): string {
  const d = parseISO(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fullDateLabel(iso: string): string {
  const d = parseISO(iso);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel(iso)}`;
}
