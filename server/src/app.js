import express from 'express';
import cors from 'cors';
import config from './config.js';
import { createCaptcha, verifyCaptcha } from './captcha.js';
import { rateLimit, clientIp } from './rateLimit.js';
import * as auth from './auth.js';
import { recognizeFood } from './deepseek.js';
import { calcNutrition, searchFoods } from './nutrition.js';
import { chat } from './chat.js';
import { deleteRecords, getRecords, putRecords, updateUser } from './store.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

/* --------------------------- 个人资料与头像 --------------------------- */

const AVATAR_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const GOALS = ['lose', 'gain', 'maintain'];
const GENDERS = ['male', 'female'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(config.dataDir, 'uploads');

function numInRange(v, min, max) {
  if (v === null || v === undefined || v === '') return { ok: true, value: null };
  const n = Number(v);
  if (!Number.isFinite(n)) return { ok: false, value: null };
  // 保留 1 位小数（体重等字段），与身体测量记录 round(,1) 的口径一致；整数项仍保持整数。
  return { ok: n >= min && n <= max, value: Math.round(n * 10) / 10 };
}

/** 校验并规范化资料字段，返回 { patch } 或 { error }。 */
function sanitizeProfile(body) {
  const patch = {};
  if (body.nickname !== undefined) {
    const nickname = String(body.nickname || '').trim().slice(0, 20);
    if (!nickname) return { error: '昵称不能为空' };
    patch.nickname = nickname;
  }
  if (body.goal !== undefined) {
    if (!GOALS.includes(body.goal)) return { error: '健身目标无效' };
    patch.goal = body.goal;
  }
  if (body.gender !== undefined) {
    if (body.gender !== null && !GENDERS.includes(body.gender)) return { error: '性别无效' };
    patch.gender = body.gender;
  }
  for (const [key, min, max, label] of [
    ['targetKcal', 500, 10000, '每日目标摄入'],
    ['heightCm', 50, 300, '身高'],
    ['weightKg', 20, 400, '体重'],
    ['age', 1, 120, '年龄'],
  ]) {
    if (body[key] !== undefined) {
      const r = numInRange(body[key], min, max);
      if (!r.ok) return { error: `${label}需在 ${min}–${max} 之间` };
      patch[key] = r.value;
    }
  }
  return { patch };
}

function validateAvatar(base64, mime) {
  if (typeof base64 !== 'string' || base64.length < 100) return { error: '头像数据无效' };
  if (!AVATAR_MIME.includes(mime || '')) return { error: '头像格式不支持，请使用 JPG/PNG/WebP' };
  if (Math.floor((base64.length * 3) / 4) > MAX_AVATAR_BYTES) return { error: '头像过大（需小于 2MB）' };
  if (!/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) return { error: '头像数据编码无效' };
  return { ext: (mime || '').split('/')[1].replace('jpeg', 'jpg'), mime };
}

function avatarUrlFor(user) {
  // 优先使用版本化文件名 avatarFile（每次上传都是唯一文件名，天然避免旧缓存命中）；
  // 兼容旧数据：没有 avatarFile 时回退到 <id>.<ext>。
  const file = user.avatarFile || (user.avatarExt && `${user.id}.${user.avatarExt}`);
  if (!file || !user.avatarMime) return null;
  try {
    const buf = fs.readFileSync(path.join(uploadsDir, file));
    return `data:${user.avatarMime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

function withAvatar(user) {
  return { ...auth.publicUser(user), avatarUrl: avatarUrlFor(user) };
}

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

const RECORD_KEYS = ['workouts', 'foods', 'measurements', 'manualBurns'];
const MAX_RECORDS = 5000;

/** 校验并规范化记录集合，返回 { workouts, foods, measurements, manualBurns }。 */
function sanitizeRecords(input) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = { workouts: [], foods: [], measurements: [], manualBurns: [] };
  for (const key of RECORD_KEYS) {
    const arr = Array.isArray(src[key]) ? src[key] : [];
    out[key] = arr
      .filter((it) => it && typeof it === 'object' && !Array.isArray(it))
      .slice(0, MAX_RECORDS)
      .map((it) => {
        const rec = { ...it, id: String(it.id || '').slice(0, 64), date: String(it.date || '').slice(0, 32) };
        // 食物记录的 imageUri 是本地图片引用（本机 URI/data URL），不随记录同步到服务端。
        if (key === 'foods') rec.imageUri = null;
        return rec;
      });
  }
  return out;
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
  // 注册即返回带最新头像的用户（含 avatarUrl / avatarVersion）
  res.json({ token: result.token, user: withAvatar(result.user) });
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
  // 登录即返回带最新头像的用户（含 avatarUrl / avatarVersion）
  res.json({ token: result.token, user: withAvatar(result.user) });
});

app.post('/api/auth/logout', requireAuth, async (req, res) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  await auth.logout(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: withAvatar(req.auth.user) });
});

app.patch('/api/auth/me', requireAuth, async (req, res) => {
  const { patch, error } = sanitizeProfile(req.body || {});
  if (error) return res.status(400).json({ error });
  if (Object.keys(patch).length === 0) {
    return res.json({ user: withAvatar(req.auth.user) });
  }
  patch.updatedAt = new Date().toISOString();
  await updateUser(req.auth.user.id, patch);
  res.json({ user: withAvatar({ ...req.auth.user, ...patch }) });
});

app.post('/api/avatar', requireAuth, async (req, res) => {
  const { imageBase64, mimeType } = req.body || {};
  const av = validateAvatar(imageBase64, mimeType);
  if (av.error) return res.status(400).json({ error: av.error });

  // 绑定当前认证用户，绝不信任客户端传入的 userId。
  const userId = req.auth.user.id;
  // 版本化文件名：每次上传都是唯一文件，避免旧缓存命中，也让「清理旧文件」有明确目标。
  const version = Date.now();
  const filename = `${userId}-${version}.${av.ext}`;
  const oldFile = req.auth.user.avatarFile || null;

  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, filename), Buffer.from(imageBase64, 'base64'));
  } catch {
    return res.status(500).json({ error: '头像保存失败，请稍后重试' });
  }

  const patch = {
    avatarFile: filename,
    avatarMime: av.mime,
    avatarVersion: version,
    updatedAt: new Date().toISOString(),
  };
  await updateUser(userId, patch);

  // 数据库已成功切换到新头像后，再清理旧文件（best-effort，失败不影响新头像使用）。
  if (oldFile && oldFile !== filename) {
    try {
      fs.unlinkSync(path.join(uploadsDir, oldFile));
    } catch {
      // 忽略：旧文件清理失败不影响新头像
    }
  }

  res.json({ user: withAvatar({ ...req.auth.user, ...patch }) });
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

app.get('/api/records', requireAuth, (req, res) => {
  res.json({ records: getRecords(req.auth.user.id) });
});

app.put('/api/records', requireAuth, async (req, res) => {
  const records = sanitizeRecords((req.body || {}).records);
  await putRecords(req.auth.user.id, records);
  res.json({ ok: true });
});

app.delete('/api/records', requireAuth, async (req, res) => {
  await deleteRecords(req.auth.user.id);
  res.json({ ok: true });
});

app.use((_req, res) => res.status(404).json({ error: '接口不存在' }));

export default app;
