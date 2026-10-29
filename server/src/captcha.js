import crypto from 'node:crypto';

/**
 * 内置图形验证码（CAPTCHA）。
 *
 * 诚实说明：这是「仅限本地开发/演示」的服务端验证码方案，用于演示
 * 「服务端签发 → 前端展示 → 服务端校验（一次性 + 有效期 + 次数限制）」的完整链路，
 * 它不是生产级人机验证。生产环境建议接入成熟服务（Cloudflare Turnstile 等），
 * 见 config.CAPTCHA_PROVIDER。
 */

const store = new Map(); // captchaId -> { code, expiresAt, attempts, used }
const TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += CHARS[crypto.randomInt(CHARS.length)];
  return s;
}

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expiresAt < now) store.delete(k);
}

export function createCaptcha() {
  cleanup();
  const code = randomCode(4);
  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { code, expiresAt: Date.now() + TTL_MS, attempts: 0, used: false });
  return { captchaId: id, svg: renderSvg(code) };
}

export function verifyCaptcha(captchaId, input) {
  const rec = store.get(captchaId);
  if (!rec) return { ok: false, error: '验证码已过期，请刷新' };
  if (rec.used) return { ok: false, error: '验证码已使用，请刷新' };
  if (rec.expiresAt < Date.now()) {
    store.delete(captchaId);
    return { ok: false, error: '验证码已过期，请刷新' };
  }
  rec.attempts += 1;
  if (rec.attempts > MAX_ATTEMPTS) {
    store.delete(captchaId);
    return { ok: false, error: '尝试次数过多，请刷新验证码' };
  }
  const ok = rec.code === String(input || '').trim().toUpperCase();
  if (ok) rec.used = true;
  return ok ? { ok: true } : { ok: false, error: '验证码错误' };
}

/** 生成带干扰线与轻微旋转的 SVG 验证码，返回 data URL。 */
function renderSvg(code) {
  const w = 120;
  const h = 44;
  const cw = w / (code.length + 1);
  let chars = '';
  for (let i = 0; i < code.length; i++) {
    const x = cw * (i + 1);
    const y = 27 + (Math.random() * 8 - 4);
    const rot = Math.random() * 30 - 15;
    chars += `<text x="${x}" y="${y}" font-size="26" font-family="monospace" font-weight="700" fill="#1a1a1a" text-anchor="middle" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`;
  }
  let noise = '';
  for (let i = 0; i < 4; i++) {
    noise += `<line x1="0" y1="${(Math.random() * h).toFixed(1)}" x2="${w}" y2="${(Math.random() * h).toFixed(1)}" stroke="#c6cdc9" stroke-width="1"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="8" fill="#f2f4f3"/>${noise}${chars}</svg>`;
  return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
}
