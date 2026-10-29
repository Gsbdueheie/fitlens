import type {
  FoodRecognitionInput,
  FoodRecognitionResult,
  FoodRecognitionService,
  RecognizedFood,
} from './types';
import type { Per100g } from '@/lib/nutrition';

/**
 * 模拟食物识别服务（Demo 默认实现，无需任何 API 密钥）。
 *
 * 诚实声明：该实现【不读取】上传图片的真实内容，仅依据图片 URI 的哈希
 * 从一组预设示例中确定性地挑一个结果返回，用于演示「拍照 → 识别 → 确认/修正
 * → 保存」的完整交互流程。它不代表任何真实模型的识别能力，也不产生任何
 * 可引用的准确率数据。
 */

interface SampleEntry {
  foodName: string;
  amountG: number;
  per100: Per100g;
  confidence: number;
}

const SAMPLES: SampleEntry[] = [
  {
    foodName: '鸡胸肉沙拉',
    amountG: 350,
    per100: { calories: 120, protein: 20, carbs: 5, fat: 2 },
    confidence: 0.66,
  },
  {
    foodName: '番茄炒蛋配米饭',
    amountG: 380,
    per100: { calories: 128, protein: 5, carbs: 20, fat: 4 },
    confidence: 0.58,
  },
  {
    foodName: '牛肉面',
    amountG: 450,
    per100: { calories: 130, protein: 6, carbs: 18, fat: 4 },
    confidence: 0.62,
  },
  {
    foodName: '燕麦香蕉牛奶',
    amountG: 300,
    per100: { calories: 107, protein: 4, carbs: 18, fat: 2.5 },
    confidence: 0.7,
  },
  {
    foodName: '三文鱼糙米碗',
    amountG: 400,
    per100: { calories: 158, protein: 10, carbs: 14, fat: 7 },
    confidence: 0.64,
  },
  {
    foodName: '全麦鸡肉三明治',
    amountG: 220,
    per100: { calories: 190, protein: 14, carbs: 22, fat: 6 },
    confidence: 0.6,
  },
];

const MOCK_NOTE =
  '模拟识别（Demo）：未调用真实视觉模型，结果基于预设示例，' +
  '不代表对上传图片的真实识别。请确认并修正后再保存。';

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class MockFoodRecognitionService implements FoodRecognitionService {
  async recognize(input: FoodRecognitionInput): Promise<FoodRecognitionResult> {
    // 模拟网络/模型耗时，便于展示加载状态
    await delay(900 + (hashString(input.imageUri) % 500));

    const entry = SAMPLES[hashString(input.imageUri) % SAMPLES.length];
    const item: RecognizedFood = {
      foodName: entry.foodName,
      amountG: entry.amountG,
      per100: entry.per100,
      confidence: entry.confidence,
    };

    return {
      items: [item],
      isMock: true,
      provider: 'mock',
      uncertaintyNote: MOCK_NOTE,
      generatedAt: new Date().toISOString(),
    };
  }
}
