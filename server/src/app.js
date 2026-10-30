import express from 'express';
import cors from 'cors';
import config from './config.js';
import { createCaptcha, verifyCaptcha } from './captcha.js';
import { rateLimit, clientIp } from './rateLimit.js';
import * as auth from './auth.js';
import { recognizeFood } from './deepseek.js';
import { calcNutrition, searchFoods } from './nutrition.js';
import { chat } from './chat.js';
import { updateUser } from './store.js';

const app = express();

app.use(
  cors({
    origin: config.allowedOrigins.includes('*') ? true : config.allowedOrigins,
  }),
);
// 图片以 base64 传输（20MB 原图 ≈ 27MB base64），放宽 JSON 体积限制
app.use(express.json({ limit: '30mb' }));

/* ------------------------------ 校验工具 ------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

function validEmail(e) {
  return typeof e === 'string' && EMAIL_RE.test(e.trim());
}
function validPassword(p) {
  return (
    typeof p === 'string' &&
    p.length >= 8 &&
    p.length <= 72 &&
    /[A-Za-z]/.test(p) &&
    /\d/.test(p)
  );
}
function validateImage(base64, mime) {
  if (typeof base64 !== 'string' || base64.length < 100) {
    return { error: '图片数据无效' };
  }
  if (!ALLOWED_MIME.includes(mime || '')) {
    return { error: '不支持的图片格式，请使用 JPG/PNG/WebP/GIF' };
  }
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAX_IMAGE_BYTES) {
    return { error: '图片超过 20MB，请压缩或选择更小的图片' };
  }
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
    return { error: '图片数据编码无效' };
  }
  return { bytes };
}

/* ------------------------------- 中间件 ------------------------------- */

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const r = auth.authenticate(token);
  if (!r) return res.status(401).json({ error: '未登录或会话已过期' });
  req.auth = r;
  next();
}

/* ---------------------------- CAPTCHA 校验 ---------------------------- */

async function checkCaptcha(body) {
  if (config.captchaProvider === 'turnstile') {
    return verifyTurnstile(body.captchaToken);
  }
  return verifyCaptcha(body.captchaId, body.captchaInput);
}

async function verifyTurnstile(token) {
  if (!config.turnstileSecret) {
    return { ok: false, error: 'CAPTCHA 服务未配置' };
  }
  try {
    const form = new URLSearchParams({
      secret: config.turnstileSecret,
      response: String(token || ''),
    });
    const r = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: form },
    );
    const j = await r.json();
    return j.success ? { ok: true } : { ok: false, error: '验证失败，请重试' };
  } catch {
    return { ok: false, error: 'CAPTCHA 服务暂不可用，请稍后再试' };
  }
}

/* -------------------------------- 路由 -------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    aiConfigured: config.aiConfigured(),
    captchaProvider: config.captchaProvider,
  });
});

app.post('/api/captcha', (_req, res) => {
  res.json(createCaptcha());
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, nickname } = req.body || {};
  const ip = clientIp(req);

  const rlIp = rateLimit(`reg:ip:${ip}`, { windowMs: 3600000, max: 10 });
  const rlEmail = rateLimit(`reg:email:${String(email || '').toLowerCase()}`, {
    windowMs: 3600000,
    max: 5,
  });
  if (!rlIp.ok || !rlEmail.ok) {
    return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  }
  if (!validEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱地址' });
  if (!validPassword(password)) {
    return res.status(400).json({ error: '密码需至少 8 位，且同时包含字母和数字' });
  }

  const cap = await checkCaptcha(req.body || {});
  if (!cap.ok) return res.status(400).json({ error: cap.error });

  const result = await auth.register({
    email: String(email).trim().toLowerCase(),
    password,
    nickname,
  });
  if (result.error) return res.status(409).json({ error: result.error });
  res.json(result);
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const ip = clientIp(req);

  const rlIp = rateLimit(`login:ip:${ip}`, { windowMs: 3600000, max: 20 });
  const rlEmail = rateLimit(`login:email:${String(email || '').toLowerCase()}`, {
    windowMs: 3600000,
    max: 10,
  });
  if (!rlIp.ok || !rlEmail.ok) {
    return res.status(429).json({ error: '尝试次数过多，请稍后再试' });
  }
  if (!validEmail(email)) return res.status(400).json({ error: '请输入有效的邮箱地址' });
  if (!password) return res.status(400).json({ error: '请输入密码' });

  const cap = await checkCaptcha(req.body || {});
  if (!cap.ok) return res.status(400).json({ error: cap.error });

  const result = await auth.login({
    email: String(email).trim().toLowerCase(),
    password,
  });
  if (result.error) return res.status(401).json({ error: result.error });
  res.json(result);
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  await auth.logout(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: auth.publicUser(req.auth.user) });
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const nickname = String((req.body || {}).nickname || '').trim().slice(0, 20);
  if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
  await updateUser(req.auth.user.id, { nickname });
  res.json({ user: auth.publicUser({ ...req.auth.user, nickname }) });
});

app.post('/api/recognize', requireAuth, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  const img = validateImage(imageBase64, mimeType);
  if (img.error) return res.status(400).json({ error: img.error });

  const rl = rateLimit(`rec:user:${req.auth.user.id}`, { windowMs: 60000, max: 20 });
  if (!rl.ok) return res.status(429).json({ error: '识别请求过于频繁，请稍后再试' });

  const result = await recognizeFood({ imageBase64, mimeType });
  if (result.error) return res.status(502).json({ error: result.error });

  // 优先查营养数据库；查不到再用模型的粗略热量范围作为「AI 估算」兜底。
  const foods = result.foods.map((f) => {
    const { estimate, ...rest } = f;
    const nutrition = calcNutrition(f.name, f.amount);
    if (nutrition) {
      return { ...rest, matchTier: 'database', nutrition, estimate: null };
    }
    return { ...rest, matchTier: 'none', nutrition: null, estimate: estimate ?? null };
  });
  res.json({ foods, uncertainty: result.uncertainty });
});

app.post('/api/nutrition', requireAuth, (req, res) => {
  const { name, amount } = req.body || {};
  if (!name) return res.status(400).json({ error: '缺少食物名称' });
  const nutrition = calcNutrition(name, Number(amount) || 0);
  res.json({ nutrition }); // 未查到时为 null
});

app.get('/api/foods/search', requireAuth, (req, res) => {
  const q = String(req.query.q || '').trim();
  res.json({ foods: q ? searchFoods(q, 20) : [] });
});

app.post('/api/chat', requireAuth, async (req, res) => {
  const { messages } = req.body || {};
  const rl = rateLimit(`chat:user:${req.auth.user.id}`, { windowMs: 60000, max: 30 });
  if (!rl.ok) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  const result = await chat(messages);
  if (result.error) return res.status(502).json({ error: result.error });
  res.json(result);
});

app.use((_req, res) => res.status(404).json({ error: '接口不存在' }));

export default app;
