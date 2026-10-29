import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 极简 .env 加载（不依赖 dotenv）：仅当环境变量尚未设置时才写入。 */
function loadEnv(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    // 没有 .env 文件时忽略
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  dataDir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  deepseekApiKey: process.env.DEEPSEEK_API_KEY || '',
  deepseekBaseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
  deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-flash',

  sessionTtlMs: parseInt(process.env.SESSION_TTL_MS || String(7 * 24 * 3600 * 1000), 10),

  captchaProvider: process.env.CAPTCHA_PROVIDER || 'builtin',
  turnstileSecret: process.env.TURNSTILE_SECRET_KEY || '',

  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  /** AI 服务是否已配置（用于 /api/health 告知前端） */
  aiConfigured() {
    return Boolean(this.deepseekApiKey);
  },
};

export default config;
