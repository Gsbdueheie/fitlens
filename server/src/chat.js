import config from './config.js';

/**
 * 健身与减脂智能助手（服务端调用 DeepSeek，密钥仅在服务端环境变量）。
 * 仅做文本对话，不读取/修改用户的饮食、训练、身体数据；用户信息只能由用户在对话中主动提供。
 */

const SYSTEM_PROMPT = [
  '你是 FitLens 的健身与减脂智能助手。用简体中文回答，语气专业、务实、克制。',
  '你的职责：',
  '- 提供循序渐进的减脂方法、饮食记录建议、每周训练计划（频率/时长/休息安排）；',
  '- 根据用户主动提供的信息（目标、经验、可用时间、场地、预算、器材、身体与记录数据）给出个性化初步建议，并说明你所依据的信息；',
  '- 针对爬坡、跑步、跑楼梯、力量训练等具体训练给出可执行的安排；',
  '- 推荐健身器材时，先了解预算、空间、训练经验和目标，说明选择理由、适用场景、替代方案与使用注意事项，不默认推荐昂贵器材。',
  '安全边界（必须遵守）：',
  '- 不提供极端节食或快速暴瘦方案，建议应循序渐进、包含休息与恢复；',
  '- 不做疾病诊断、医疗处方或伤病治疗；',
  '- 用户提到怀孕、慢性病、疼痛、受伤或饮食障碍等高风险情况时，建议咨询合格的医疗或营养专业人士，不给出冒险的训练指令；',
  '- 不把卡路里赤字或运动消耗说成精确值，清楚说明是估算与假设；',
  '- 信息不足时先提出少量关键问题，不擅自编造用户个人信息；',
  '- 训练计划应包含每周安排、动作/训练类型、时长或组数、强度调整方式和休息日；用户无设备时提供徒手或低成本替代。',
].join('\n');

const MAX_TURNS = 12; // 最多保留最近 12 条消息

export async function chat(messages) {
  if (!config.deepseekApiKey) {
    return { error: '智能助手未配置：请在服务端设置 DEEPSEEK_API_KEY' };
  }

  const history = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
    .map((m) => ({
      role: m.role,
      content: String(m.content || '').slice(0, 2000),
    }))
    .slice(-MAX_TURNS);

  if (!history.some((m) => m.role === 'user')) {
    return { error: '请输入你的问题' };
  }

  const body = {
    model: config.deepseekModel,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    temperature: 0.6,
    max_tokens: 1000,
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
    return { error: '无法连接 AI 服务，请稍后重试' };
  }

  if (!res.ok) {
    if (res.status === 401) return { error: 'DeepSeek API Key 无效，请检查服务端配置' };
    if (res.status === 429) return { error: '助手请求过于频繁，请稍后重试' };
    return { error: `AI 服务错误（${res.status}），请稍后重试` };
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (!content) return { error: '助手未返回内容，请重试' };
  return { reply: String(content).slice(0, 4000) };
}
