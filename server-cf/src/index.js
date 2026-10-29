import foods from './foods.js';

/**
 * FitLens 后端（Cloudflare Workers 版）。
 * - 密码哈希：PBKDF2-SHA256（WebCrypto，原生硬件加速，不占 JS CPU 预算）。
 * - 存储：Cloudflare KV（FITLENS_KV binding）。
 * - 密钥：DEEPSEEK_API_KEY 通过 `wrangler secret put` 或平台密钥设置注入，前端不接触。
 * - CAPTCHA：服务端签发图形验证码（KV 存储 + 5 分钟 TTL + 一次性）。
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const CAPTCHA_TTL_SEC = 300;

/* ------------------------------ 小工具 ------------------------------ */

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}

function corsHeaders(env, request) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);
  const origin = request.headers.get('Origin') || '';
  const allowOrigin = allowed.includes('*') ? (origin || '*') : (allowed.includes(origin) ? origin : '');
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function error(msg, status) {
  const e = new Error(msg);
  e.status = status;
  return e;
}

function validEmail(e) {
  return typeof e === 'string' && EMAIL_RE.test(e.trim());
}
function validPassword(p) {
  return typeof p === 'string' && p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p);
}
function validateImage(base64, mime) {
  if (typeof base64 !== 'string' || base64.length < 100) return '图片数据无效';
  if (!ALLOWED_MIME.includes(mime || '')) return '不支持的图片格式，请使用 JPG/PNG/WebP/GIF';
  if (Math.floor((base64.length * 3) / 4) > MAX_IMAGE_BYTES) return '图片过大（需小于 8MB）';
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) return '图片数据编码无效';
  return null;
}

/* ------------------------------ 密码哈希 ------------------------------ */

const enc = new TextEncoder();

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, 256);
  return `pbkdf2$${iterations}$${toB64(salt)}$${toB64(new Uint8Array(bits))}`;
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4) return false;
  const iterations = parseInt(parts[1], 10);
  const salt = fromB64(parts[2]);
  const expect = parts[3];
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, keyMaterial, 256);
  return toB64(new Uint8Array(bits)) === expect;
}

function toB64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function fromB64(b64) {
  const s = atob(b64);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

function genToken() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return toB64(b).replace(/[+/=]/g, '').slice(0, 43);
}
function genId() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return toB64(b).replace(/[+/=]/g, '');
}

/* ------------------------------ 存储（KV） ------------------------------ */

async function getUser(env, email) {
  return env.FITLENS_KV.get(`user:${email}`, 'json');
}
async function putUser(env, user) {
  await env.FITLENS_KV.put(`user:${user.email}`, JSON.stringify(user));
}
async function getSession(env, token) {
  return env.FITLENS_KV.get(`session:${token}`, 'json');
}
async function putSession(env, s) {
  await env.FITLENS_KV.put(`session:${s.token}`, JSON.stringify(s));
}
async function delSession(env, token) {
  await env.FITLENS_KV.delete(`session:${token}`);
}

/* ------------------------------ CAPTCHA ------------------------------ */

const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function captchaCode(len = 4) {
  let s = '';
  for (let i = 0; i < len; i++) s += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
  return s;
}
function renderCaptchaSvg(code) {
  const w = 120, h = 44, cw = w / (code.length + 1);
  let chars = '';
  for (let i = 0; i < code.length; i++) {
    const x = cw * (i + 1), y = 27 + (Math.random() * 8 - 4), rot = Math.random() * 30 - 15;
    chars += `<text x="${x}" y="${y}" font-size="26" font-family="monospace" font-weight="700" fill="#1a1a1a" text-anchor="middle" transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">${code[i]}</text>`;
  }
  let noise = '';
  for (let i = 0; i < 4; i++) noise += `<line x1="0" y1="${(Math.random() * h).toFixed(1)}" x2="${w}" y2="${(Math.random() * h).toFixed(1)}" stroke="#c6cdc9" stroke-width="1"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" rx="8" fill="#f2f4f3"/>${noise}${chars}</svg>`;
  return 'data:image/svg+xml;base64,' + btoa(svg);
}
async function createCaptcha(env) {
  const code = captchaCode();
  const id = genId();
  await env.FITLENS_KV.put(`captcha:${id}`, JSON.stringify({ code, attempts: 0 }), { expirationTtl: CAPTCHA_TTL_SEC });
  return { captchaId: id, svg: renderCaptchaSvg(code) };
}
async function verifyCaptcha(env, captchaId, input) {
  const rec = await env.FITLENS_KV.get(`captcha:${captchaId}`, 'json');
  if (!rec) return { ok: false, error: '验证码已过期，请刷新' };
  if (rec.attempts >= 5) {
    await env.FITLENS_KV.delete(`captcha:${captchaId}`);
    return { ok: false, error: '尝试次数过多，请刷新验证码' };
  }
  if (rec.code === String(input || '').trim().toUpperCase()) {
    await env.FITLENS_KV.delete(`captcha:${captchaId}`);
    return { ok: true };
  }
  rec.attempts += 1;
  await env.FITLENS_KV.put(`captcha:${captchaId}`, JSON.stringify(rec), { expirationTtl: CAPTCHA_TTL_SEC });
  return { ok: false, error: '验证码错误' };
}

/* ------------------------------ 限速（内存，尽力而为） ------------------------------ */

const buckets = new Map();
function rateLimit(key, windowMs, max) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b.count <= max;
}

/* ------------------------------ 营养 ------------------------------ */

function lookupFood(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  let best = null;
  for (const f of foods) {
    if (f.name === n) return f;
    if (n.includes(f.name) || f.name.includes(n)) {
      if (!best || f.name.length > best.name.length) best = f;
    }
  }
  return best;
}
function calcNutrition(foodName, amountG) {
  const f = lookupFood(foodName);
  if (!f) return null;
  const k = Math.max(0, Number(amountG) || 0) / 100;
  return {
    source: '内置食物营养表（近似值）',
    calories: Math.round(f.calories * k),
    protein: round1(f.protein * k),
    carbs: round1(f.carbs * k),
    fat: round1(f.fat * k),
  };
}
function round1(n) {
  return Math.round(n * 10) / 10;
}

/* ------------------------------ DeepSeek ------------------------------ */

const SYSTEM_PROMPT = [
  '你是营养分析助手。请识别这张食物照片，只输出一个 JSON 对象（不要输出任何其他文字，不要用 Markdown 代码块），格式如下：',
  '{"foods":[{"name":"食物名称（中文）","amount":估算克数(数字)","portion":"份量描述，如 约一碗/约半盘/约一个拳头大小","ingredients":["可辨认的食材"],"confidence":0到1}],"uncertainty":"关于份量与热量不确定性的简短中文说明"}',
  '要求：',
  '- 用常见参照物（碗/盘/拳头/手掌/筷子）估算份量，amount 给出克数，portion 给出文字描述；',
  '- 份量克数是粗略估算，务必在 uncertainty 提醒用户核对份量；',
  '- 热量无法从照片精确测得，油、酱料、配方、隐藏食材都会影响热量；',
  '- 混合菜、遮挡、模糊或不确定时降低 confidence。',
].join('\n');

async function recognizeFood(env, imageBase64, mimeType) {
  if (!env.DEEPSEEK_API_KEY) return { error: 'AI 服务未配置：请在服务端设置 DEEPSEEK_API_KEY' };
  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;
  const baseUrl = (env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';

  const body = {
    model,
    messages: [{ role: 'user', content: [{ type: 'text', text: SYSTEM_PROMPT }, { type: 'image_url', image_url: { url: dataUrl } }] }],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
  };

  let res;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
      body: JSON.stringify(body),
    });
  } catch {
    return { error: '无法连接 AI 服务，请稍后重试' };
  }

  if (!res.ok) {
    if (res.status === 401) return { error: 'DeepSeek API Key 无效，请检查服务端配置' };
    if (res.status === 429) return { error: 'AI 服务限流，请稍后重试' };
    return { error: `AI 服务错误（${res.status}），请稍后重试` };
  }

  const j = await res.json().catch(() => null);
  const content = j?.choices?.[0]?.message?.content;
  if (!content) return { error: '模型未返回内容，请重试' };

  let text = String(content);
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const s = text.indexOf('{');
  const e = text.lastIndexOf('}');
  if (s >= 0 && e > s) text = text.slice(s, e + 1);

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { error: '模型返回格式异常，请重试' };
  }

  const parsedFoods = Array.isArray(obj.foods)
    ? obj.foods.map((f) => ({
        name: String(f?.name || '').trim().slice(0, 60),
        amount: clampNum(f?.amount, 10, 5000),
        portion: String(f?.portion || '').trim().slice(0, 40),
        ingredients: Array.isArray(f?.ingredients) ? f.ingredients.map((i) => String(i).trim().slice(0, 40)).slice(0, 12) : [],
        confidence: clampNum(f?.confidence, 0, 1),
      })).filter((f) => f.name)
    : [];

  if (!parsedFoods.length) return { error: '未能从图片中识别出食物，请换一张更清晰的照片，或手动记录' };

  return {
    foods: parsedFoods,
    uncertainty: String(obj.uncertainty || '照片无法精确判断份量与热量，请确认份量。').slice(0, 200),
  };
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------ 认证 ------------------------------ */

async function createSession(env, user) {
  const token = genToken();
  const s = {
    token,
    userId: user.id,
    email: user.email,
    nickname: user.nickname,
    createdAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  await putSession(env, s);
  return s;
}

function publicUser(user) {
  return { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.createdAt };
}

/* ------------------------------ 路由 ------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();
    const h = corsHeaders(env, request);

    if (method === 'OPTIONS') return new Response(null, { status: 204, headers: h });

    try {
      const handler = ROUTES[`${method} ${path}`];
      if (!handler) return json({ error: '接口不存在' }, 404, h);
      return await handler(request, env, h);
    } catch (e) {
      return json({ error: (e && e.message) || '服务器错误' }, (e && e.status) || 500, h);
    }
  },
};

async function bodyJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

async function requireAuth(request, env) {
  const h = request.headers.get('Authorization') || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const s = token ? await getSession(env, token) : null;
  if (!s || s.expiresAt < Date.now()) throw error('未登录或会话已过期', 401);
  return { token, session: s };
}

const ROUTES = {
  'GET /api/health': async (req, env, h) =>
    json({ ok: true, aiConfigured: Boolean(env.DEEPSEEK_API_KEY), captchaProvider: env.CAPTCHA_PROVIDER || 'builtin' }, 200, h),

  'POST /api/captcha': async (req, env, h) => json(await createCaptcha(env), 200, h),

  'POST /api/auth/register': async (req, env, h) => {
    const b = await bodyJson(req);
    const email = String(b.email || '').trim().toLowerCase();
    const ip = requestIp(req);
    if (!rateLimit(`reg:ip:${ip}`, 3600000, 10) || !rateLimit(`reg:email:${email}`, 3600000, 5)) {
      return json({ error: '尝试次数过多，请稍后再试' }, 429, h);
    }
    if (!validEmail(email)) return json({ error: '请输入有效的邮箱地址' }, 400, h);
    if (!validPassword(b.password)) return json({ error: '密码需至少 8 位，且同时包含字母和数字' }, 400, h);
    const cap = await verifyCaptcha(env, b.captchaId, b.captchaInput);
    if (!cap.ok) return json({ error: cap.error }, 400, h);
    if (await getUser(env, email)) return json({ error: '该邮箱已注册' }, 409, h);

    const user = {
      id: genId(),
      email,
      passwordHash: await hashPassword(b.password),
      nickname: String(b.nickname || '').trim().slice(0, 20) || email.split('@')[0],
      createdAt: new Date().toISOString(),
    };
    await putUser(env, user);
    const s = await createSession(env, user);
    return json({ token: s.token, user: publicUser(user) }, 200, h);
  },

  'POST /api/auth/login': async (req, env, h) => {
    const b = await bodyJson(req);
    const email = String(b.email || '').trim().toLowerCase();
    const ip = requestIp(req);
    if (!rateLimit(`login:ip:${ip}`, 3600000, 20) || !rateLimit(`login:email:${email}`, 3600000, 10)) {
      return json({ error: '尝试次数过多，请稍后再试' }, 429, h);
    }
    if (!validEmail(email)) return json({ error: '请输入有效的邮箱地址' }, 400, h);
    if (!b.password) return json({ error: '请输入密码' }, 400, h);
    const cap = await verifyCaptcha(env, b.captchaId, b.captchaInput);
    if (!cap.ok) return json({ error: cap.error }, 400, h);

    const user = await getUser(env, email);
    if (!user) return json({ error: '邮箱或密码错误' }, 401, h);
    const ok = await verifyPassword(b.password, user.passwordHash);
    if (!ok) return json({ error: '邮箱或密码错误' }, 401, h);

    const s = await createSession(env, user);
    return json({ token: s.token, user: publicUser(user) }, 200, h);
  },

  'POST /api/auth/logout': async (req, env, h) => {
    const a = await requireAuth(req, env);
    await delSession(env, a.token);
    return json({ ok: true }, 200, h);
  },

  'GET /api/auth/me': async (req, env, h) => {
    const a = await requireAuth(req, env);
    return json({ user: { id: a.session.userId, email: a.session.email, nickname: a.session.nickname } }, 200, h);
  },

  'PATCH /api/auth/me': async (req, env, h) => {
    const a = await requireAuth(req, env);
    const b = await bodyJson(req);
    const nickname = String(b.nickname || '').trim().slice(0, 20);
    if (!nickname) return json({ error: '昵称不能为空' }, 400, h);
    const user = await getUser(env, a.session.email);
    if (user) {
      user.nickname = nickname;
      await putUser(env, user);
    }
    await putSession(env, { ...a.session, nickname });
    return json({ user: { id: a.session.userId, email: a.session.email, nickname } }, 200, h);
  },

  'POST /api/recognize': async (req, env, h) => {
    const a = await requireAuth(req, env);
    if (!rateLimit(`rec:${a.session.userId}`, 60000, 20)) return json({ error: '识别请求过于频繁，请稍后再试' }, 429, h);
    const b = await bodyJson(req);
    const imgErr = validateImage(b.imageBase64, b.mimeType);
    if (imgErr) return json({ error: imgErr }, 400, h);
    const result = await recognizeFood(env, b.imageBase64, b.mimeType);
    if (result.error) return json({ error: result.error }, 502, h);
    const foodsWithNutrition = result.foods.map((f) => ({ ...f, nutrition: calcNutrition(f.name, f.amount) }));
    return json({ foods: foodsWithNutrition, uncertainty: result.uncertainty }, 200, h);
  },

  'POST /api/nutrition': async (req, env, h) => {
    await requireAuth(req, env);
    const b = await bodyJson(req);
    if (!b.name) return json({ error: '缺少食物名称' }, 400, h);
    return json({ nutrition: calcNutrition(b.name, Number(b.amount) || 0) }, 200, h);
  },
};

function requestIp(req) {
  return (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
}
