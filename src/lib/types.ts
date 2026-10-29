/**
 * FitLens 数据模型。
 * 单位约定：所有热量字段一律以 kcal（千卡）存储与计算，
 * 界面显示时标注为「卡」（1 卡 = 1 kcal），见 format.ts 的 KCAL_UNIT_NOTE。
 */

export type Goal = 'lose' | 'gain' | 'maintain';
export type Gender = 'male' | 'female' | null;
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Mood = 'great' | 'ok' | 'tired' | null;

export interface UserProfile {
  email: string | null;
  nickname: string;
  avatarUri: string | null; // 本地图片 / data URL（仅保存在本机）
  goal: Goal;
  targetKcal: number | null; // 每日目标摄入（kcal）。null 时按 goal 取默认值
  heightCm: number | null;
  age: number | null;
  gender: Gender;
}

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // 训练类型（力量/跑步/骑行/游泳/瑜伽/爬坡/跑楼梯/其他）
  durationMin: number;
  caloriesBurned: number | null; // kcal，可为空（未填写时界面显示「未记录」，不伪造）
  note: string;
  mood: Mood;
  isSample?: boolean; // 是否为预置示例数据
  createdAt: string;
  updatedAt: string;
}

export interface FoodRecord {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  foodName: string;
  amountG: number; // 份量（克）
  calories: number; // kcal
  protein: number; // g
  carbs: number; // g
  fat: number; // g
  source: 'ai' | 'manual'; // ai = 拍照识别；manual = 手动录入
  isMock: boolean; // 兼容字段：接入真实模型后恒为 false
  confidence: number | null; // 0..1，模型置信度；手动录入为 null
  uncertaintyNote: string | null; // 估算依据 / 不确定性说明
  nutritionSource: string | null; // 营养数据来源说明
  imageUri: string | null; // 识别所用图片（本机 URI/data URL）
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number | null;
  waistCm: number | null;
  hipCm: number | null;
  note: string;
  isSample?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualBurn {
  id: string;
  date: string; // YYYY-MM-DD
  calories: number; // kcal，手动补充的运动消耗（避免与训练记录重复计算）
  note: string;
  isSample?: boolean;
  createdAt: string;
}

export interface DailySummary {
  date: string;
  intake: number; // 摄入 kcal
  burn: number; // 运动消耗 kcal（训练汇总 + 手动补充）
  target: number; // 目标 kcal
  remaining: number; // 剩余 = 目标 + 运动消耗 - 摄入
  protein: number;
  carbs: number;
  fat: number;
}

/* ------------------------- AI 识别（后端返回） ------------------------- */

export interface NutritionEstimate {
  source: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface RecognizedFood {
  name: string;
  amount: number; // 估算份量克数
  portion?: string; // 份量描述（约一碗/半盘/一个拳头大小）
  ingredients: string[];
  confidence: number; // 0..1
  nutrition: NutritionEstimate | null;
}

export interface RecognizeResponse {
  foods: RecognizedFood[];
  uncertainty: string;
}

/* ------------------------------ 常量标签 ------------------------------ */

export const GOAL_LABEL: Record<Goal, string> = {
  lose: '减脂',
  gain: '增肌',
  maintain: '维持',
};

export const MEAL_LABEL: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
};

export const MOOD_LABEL: Record<Exclude<Mood, null>, string> = {
  great: '状态很好',
  ok: '状态一般',
  tired: '有点累',
};

export const WORKOUT_TYPES = [
  '力量训练',
  '跑步',
  '骑行',
  '游泳',
  '瑜伽',
  '爬坡',
  '跑楼梯',
  '其他',
] as const;
