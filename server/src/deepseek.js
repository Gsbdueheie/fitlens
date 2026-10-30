import config from './config.js';

/**
 * DeepSeek 视觉识别客户端。
 * - 密钥仅从服务端环境变量 DEEPSEEK_API_KEY 读取，前端与仓库不接触。
 * - 图片由服务端以 base64 data URL 转发给模型（不把文件名/文字当图片）。
 * - 模型输出经过健壮的结构化提取 + 字段校验 + 数值范围检查，不直接信任模型。
 * 模型：deepseek-chat（DeepSeek 官方视觉模型，直接输出结果、不做冗长推理），
 * 文档：https://api-docs.deepseek.com/zh-cn/guides/vision/
 */

const SYSTEM_PROMPT = [
  '你是营养分析助手。请识别这张食物照片，只输出一个 JSON 对象（不要输出任何其他文字，不要用 Markdown 代码块），格式如下：',
  '{"foods":[{"name":"食物名称（中文）","amount":"估算克数(数字)","portion":"份量描述，如 约一碗/约半盘/约一个拳头大小","ingredients":["可辨认的食材"],"confidence":0到1,"estimatedCalories":"约 300-500 千卡"}],"uncertainty":"关于份量与热量不确定性的简短中文说明"}',
  '要求：',
  '- 用常见参照物（碗/盘/拳头/手掌/筷子）估算份量，amount 给出可食部分克数，portion 给出文字描述；',
  '- 不要在名称或备注中使用「带壳/不带壳/去皮/去壳」等外观描述；食物名称保持简洁准确，份量按可食部分估算；若不确定可食部分，用中性表达说明「请确认可食部分重量」；',
  '- 份量克数是粗略估算，务必在 uncertainty 提醒用户核对份量；',
  '- 热量无法从照片精确测得，油、酱料、配方、隐藏食材都会影响热量；',
  '- 不要输出精确的热量或营养数值；营养优先由服务端查营养数据库计算；',
  '- 仅在无法给出常见食物名时，才在 estimatedCalories 给一个粗略热量范围（如「约 300-500 千卡」），该值仅作估算兜底；',
  '- 混合菜、遮挡、模糊或不确定时降低 confidence。',
].join('\n');

const REPAIR_INSTRUCTION =
  '\n\n（重要：上一次输出无法解析。请严格只输出一个合法的 JSON 对象，不要包含 Markdown 代码围栏，不要有任何解释文字。）';

function buildMessages(dataUrl, repair) {
  return [
    {
      role: 'user',
      content: [
        { type: 'text', text: repair ? SYSTEM_PROMPT + REPAIR_INSTRUCTION : SYSTEM_PROMPT },
        { type: 'image_url', image_url: { url: dataUrl } },
      ],
    },
  ];
}

function log(kind, detail) {
  // 只记录错误类别与少量摘要，不含密钥、认证头或图片内容。
  const d = detail != null ? ` detail=${String(detail).replace(/\s+/g, ' ').slice(0, 120)}` : '';
  console.warn(`[deepseek] kind=${kind} model=${config.deepseekModel}${d}`);
}

async function callModel(dataUrl, repair = false) {
  const body = {
    model: config.deepseekModel,
    messages: buildMessages(dataUrl, repair),
    temperature: 0.2,
    max_tokens: 2000,
  };

  let res;
  try {
    res = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.deepseekApiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    log('network');
    return { error: '无法连接 DeepSeek 服务，请稍后重试' };
  }

  if (!res.ok) {
    await res.text().catch(() => {});
    if (res.status === 401) {
      log('auth', res.status);
      return { error: 'DeepSeek API Key 无效，请检查服务端配置' };
    }
    if (res.status === 429) {
      log('rate_limit', res.status);
      return { error: 'AI 服务限流，请稍后重试' };
    }
    log('api_error', res.status);
    return { error: `AI 服务错误（${res.status}），请稍后重试` };
  }

  const json = await res.json().catch(() => null);
  const content = extractContent(json);
  if (!content) {
    const msg = json?.choices?.[0]?.message;
    log(
      'empty',
      JSON.stringify({
        keys: msg ? Object.keys(msg) : null,
        contentType: msg ? typeof msg.content : null,
        contentArray: msg ? Array.isArray(msg.content) : null,
        hasChoices: Array.isArray(json?.choices),
      }),
    );
    return { error: '模型未返回内容，请重试' };
  }
  return { content };
}

/** 兼容多种返回形态：字符串 content / 分段数组 content / reasoning_content。 */
function extractContent(json) {
  const msg = json?.choices?.[0]?.message;
  if (!msg) return null;
  if (typeof msg.content === 'string' && msg.content.trim()) return msg.content;
  if (Array.isArray(msg.content)) {
    const text = msg.content
      .map((p) => (typeof p === 'string' ? p : p?.text || ''))
      .join('')
      .trim();
    if (text) return text;
  }
  return null;
}

export async function recognizeFood({ imageBase64, mimeType }) {
  if (!config.deepseekApiKey) {
    return { error: 'AI 服务未配置：请在服务端设置 DEEPSEEK_API_KEY 环境变量' };
  }
  if (!imageBase64) {
    return { error: '未收到图片数据' };
  }

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

  const first = await callModel(dataUrl);
  if (first.error) return first;

  let parsed = parseResult(first.content);

  // 可恢复的格式错误：最多重试一次（避免无限调用与额外费用）。
  if (parsed.error === 'format') {
    log('format_retry', first.content);
    const retry = await callModel(dataUrl, true);
    if (retry.error) return retry;
    parsed = parseResult(retry.content);
  }

  if (parsed.error === 'format') {
    log('format_failed', first.content);
    return { error: '模型返回格式异常，未能解析出食物信息，请换一张更清晰的照片或手动记录' };
  }
  if (parsed.error === 'empty') {
    return { error: '未能从图片中识别出食物，请换一张更清晰的照片，或手动记录' };
  }

  return parsed;
}

/** 提取首个平衡的 {...}，兼容 Markdown 围栏与前后解释文字。 */
function extractJsonObject(text) {
  let t = String(text || '').trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < t.length; i++) {
    const c = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return t.slice(start, i + 1);
    }
  }
  return null;
}

/** 去掉「带壳/不带壳/去皮/去壳」等外观备注，避免污染名称与数据库匹配。 */
function cleanFoodName(s) {
  return String(s || '')
    .replace(/带壳|不带壳|去壳|剥壳|带皮|去皮/g, '')
    .replace(/[（(]\s*[)）]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 60);
}

/**
 * 结构化解析 + 校验 + 数值范围检查。
 * 返回 { foods, uncertainty }，或内部标记 { error: 'format' | 'empty' }。
 */
function parseResult(content) {
  const text = extractJsonObject(content);
  if (!text) return { error: 'format' };

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { error: 'format' };
  }

  const foods = Array.isArray(obj.foods)
    ? obj.foods
        .map((f) => ({
          name: cleanFoodName(f?.name),
          amount: clampNum(f?.amount, 10, 5000),
          portion: String(f?.portion || '').trim().slice(0, 40),
          ingredients: Array.isArray(f?.ingredients)
            ? f.ingredients.map((i) => String(i).trim().slice(0, 40)).slice(0, 12)
            : [],
          confidence: clampNum(f?.confidence, 0, 1),
          estimatedCalories: String(f?.estimatedCalories || '').trim().slice(0, 60) || null,
        }))
        .filter((f) => f.name)
    : [];

  if (!foods.length) return { error: 'empty' };

  return {
    foods,
    uncertainty: String(obj.uncertainty || '照片无法精确判断份量与热量，请确认份量。').slice(0, 200),
  };
}

function clampNum(v, min, max) {
  const n = Number(v);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
