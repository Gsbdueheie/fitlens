import type {
  FoodRecognitionInput,
  FoodRecognitionResult,
  FoodRecognitionService,
} from './types';

/**
 * 真实食物识别服务（可选接入，未在 Demo 中启用）。
 *
 * 接入方式：
 *  1. 部署一个后端代理接口（你的服务端），其职责是持有 API 密钥并调用
 *     真实多模态模型，前端永远不接触密钥；
 *  2. 在环境变量中配置后端地址（见 .env.example）：
 *        EXPO_PUBLIC_FOOD_API_URL=https://your-backend.example.com/api/food/recognize
 *        EXPO_PUBLIC_AI_MODE=real
 *  3. 后端按下方契约接收 { imageBase64, mimeType } 并返回 FoodRecognitionResult
 *     （isMock 应为 false）。
 *
 * 密钥安全：真实模型密钥只存在于后端，绝不写入前端代码、仓库或环境变量示例。
 */

interface RealResultContract {
  items: {
    foodName: string;
    amountG: number;
    per100: { calories: number; protein: number; carbs: number; fat: number };
    confidence: number;
  }[];
  uncertaintyNote: string;
}

export class RealFoodRecognitionService implements FoodRecognitionService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.EXPO_PUBLIC_FOOD_API_URL ?? '';
  }

  async recognize(input: FoodRecognitionInput): Promise<FoodRecognitionResult> {
    if (!this.baseUrl) {
      throw new Error(
        '未配置真实识别服务地址（EXPO_PUBLIC_FOOD_API_URL）。请改用 Demo 模拟识别，或按 README 配置后端。',
      );
    }
    if (!input.imageBase64) {
      throw new Error('真实识别需要图片 base64 数据。');
    }

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: input.imageBase64,
        mimeType: input.mimeType ?? 'image/jpeg',
      }),
    });

    if (!res.ok) {
      throw new Error(`识别服务返回错误：${res.status}`);
    }

    const data = (await res.json()) as RealResultContract;

    return {
      items: data.items,
      isMock: false,
      provider: 'real',
      uncertaintyNote: data.uncertaintyNote,
      generatedAt: new Date().toISOString(),
    };
  }
}
