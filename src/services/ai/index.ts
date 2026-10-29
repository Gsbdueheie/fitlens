import type { FoodRecognitionService } from './types';
import { MockFoodRecognitionService } from './mock';
import { RealFoodRecognitionService } from './real';

export * from './types';

/**
 * 服务工厂：默认使用模拟实现（无需密钥即可运行）。
 * 设置 EXPO_PUBLIC_AI_MODE=real 且 EXPO_PUBLIC_FOOD_API_URL 后可切换为真实服务。
 */
export function getFoodRecognitionService(): FoodRecognitionService {
  const mode = process.env.EXPO_PUBLIC_AI_MODE;
  if (mode === 'real') {
    return new RealFoodRecognitionService();
  }
  return new MockFoodRecognitionService();
}
