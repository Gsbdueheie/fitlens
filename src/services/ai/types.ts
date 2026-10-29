import type { Per100g } from '@/lib/nutrition';

/**
 * AI 食物识别服务接口。
 * 抽象这一层的目的：将来可无缝替换为真实多模态视觉模型，
 * 业务代码（识别页 / 确认页）不感知底层实现。
 */

export interface FoodRecognitionInput {
  /** 本地图片 URI（data URL 或 file:// URI），用于界面回显 */
  imageUri: string;
  /** 可选：图片的 base64（不含 data: 前缀），真实服务调用时使用 */
  imageBase64?: string;
  mimeType?: string;
}

export interface RecognizedFood {
  foodName: string;
  /** 估算份量（克） */
  amountG: number;
  /** 每 100g 营养值，用于用户调整份量时等比换算 */
  per100: Per100g;
  /** 模型置信度 0..1（仅表示模型自身的不确定性，不等于「准确率」） */
  confidence: number;
}

export interface FoodRecognitionResult {
  items: RecognizedFood[];
  /** 是否为模拟结果（未调用真实模型） */
  isMock: boolean;
  provider: 'mock' | 'real';
  /** 估算依据 / 不确定性说明，必须展示给用户 */
  uncertaintyNote: string;
  generatedAt: string;
}

export interface FoodRecognitionService {
  recognize(input: FoodRecognitionInput): Promise<FoodRecognitionResult>;
}
