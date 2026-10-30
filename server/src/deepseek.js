import config from './config.js';

/**
 * DeepSeek 视觉识别客户端。
 * - 密钥仅从服务端环境变量 DEEPSEEK_API_KEY 读取，前端与仓库不接触。
 * - 图片由服务端以 base64 data URL 转发给模型（不把文件名/文字当图片）。
 * - 模型输出经过结构化解析 + 字段校验 + 数值范围检查，不直接信任模型。
 * 模型：deepseek-flash（DeepSeek-V4.1-Flash，原生多模态），
 * 文档：https://api-docs.deepseek.com/zh-cn/guides/vision/
 */

const SYSTEM_PROMPT = [
  '你是营养分析助手。请识别这张食物照片，只输出一个 JSON 对象（不要输出任何其他文字，不要用 Markdown 代码块），格式如下：',
  '{"foods":[{"name":"食物名称（中文）","amount":"估算克数(数字)","portion":"份量描述，如 约一碗/约半盘/约一个拳头大小","ingredients":["可辨认的食材"],"confidence":0到1,"estimatedCalories":"约 300-500 千卡"}],"uncertainty":"关于份量与热量不确定性的简短中文说明"}',
  '要求：',
  '- 用常见参照物（碗/盘/拳头/手掌/筷子）估算份量，amount 给出克数，portion 给出文字描述；',
  '- 份量克数是粗略估算，务必在 uncertainty 提醒用户核对份量；',
  '- 热量无法从照片精确测得，油、酱料、配方、隐藏食材都会影响热量；',
  '- 不要输出精确的热量或营养数值；营养优先由服务端查营养数据库计算；',
  '- 仅在无法给出常见食物名时，才在 estimatedCalories 给一个粗略热量范围（如「约 300-500 千卡」），该值仅作估算兜底；',
  '- 混合菜、遮挡、模糊或不确定时降低 confidence。',
].join('\n');

export async function recognizeFood({ imageBase64, mimeType }) {
  if (!config.deepseekApiKey) {
    return { error: 'AI 服务未配置：请在服务端设置 DEEPSEEK_API_KEY 环境变量' };
  }
  if (!imageBase64) {
    return { error: '未收到图片数据' };
  }

  const dataUrl = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

  const body = {
    model: config.deepseekModel,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: SYSTEM_PROMPT },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ],
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
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
  } catch (e) {
    return { error: '无法连接 DeepSeek 服务，请稍后重试' };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) {
      return { error: 'DeepSeek API Key 无效，请检查服务端配置' };
    }
    if (res.status === 429) {
      return { error: 'AI 服务限流，请稍后重试' };
    }
    return { error: `AI 服务错误（${res.status}），请稍后重试` };
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return { error: '模型未返回内容，请重试' };

  return parseResult(content);
}

/** 结构化解析 + 校验 + 数值范围检查。 */
function parseResult(content) {
  let text = String(content || '');
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) text = text.slice(start, end + 1);

  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    return { error: '模型返回格式异常，请重试' };
  }

  const foods = Array.isArray(obj.foods)
    ? obj.foods
        .map((f) => ({
          name: String(f?.name || '').trim().slice(0, 60),
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

  if (!foods.length) {
    return { error: '未能从图片中识别出食物，请换一张更清晰的照片，或手动记录' };
  }

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
