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
  phone: string | null;
  nickname: string;
  avatarUri: string | null; // 本地图片 / data URL（仅保存在本机）
  goal: Goal;
  targetKcal: number | null; // 每日目标摄入（kcal）。null 时按 goal 取默认值
  heightCm: number | null;
  age: number | null;
  gender: Gender;
  isDemo: boolean; // 是否 Demo 登录（未接入真实短信/后端）
  createdAt: string;
  updatedAt: string;
}

export interface WorkoutRecord {
  id: string;
  date: string; // YYYY-MM-DD
  type: string; // 训练类型（力量 / 有氧 / 跑步 / 瑜伽 / 骑行 / 其他）
  durationMin: number;
  caloriesBurned: number | null; // kcal，可为空（未填则不参与消耗汇总）
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
  source: 'ai' | 'manual'; // ai = 拍照识别（含模拟）；manual = 手动录入
  isMock: boolean; // 是否为模拟识别结果
  confidence: number | null; // 0..1，模型置信度；手动录入为 null
  uncertaintyNote: string | null; // 估算依据 / 不确定性说明
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
  '有氧',
  '跑步',
  '瑜伽',
  '骑行',
  '游泳',
  '球类',
  '其他',
] as const;
