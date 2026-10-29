/**
 * 内存限速（单实例 Demo）。按 key 做固定窗口计数。
 * 生产环境应替换为 Redis 等共享存储，以支持多实例与重启后保持。
 */

const buckets = new Map();

export function rateLimit(key, { windowMs, max }) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;

  // 简单清理，避免无限增长
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
  }

  return { ok: b.count <= max, retryAfterMs: Math.max(0, b.resetAt - now) };
}

export function clientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}
