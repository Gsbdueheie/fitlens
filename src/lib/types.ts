/**
 * FitLens 数据模型。
 * 单位约定：所有热量字段一律以 kcal（千卡）存储与计算，
 * 界面显示时标注为「千卡」，见 format.ts 的 KCAL_UNIT_NOTE。
 */

export type Goal = 'lose' | 'gain' | 'maintain';
export type Gender = 'male' | 'female' | null;
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type Mood = 'great' | 'ok' | 'tired' | null;

export interface UserProfile {
  email: string | null;
  nickname: string;
  avatarUrl: string | null; // 服务端存储的头像 data URL
  goal: Goal;
  targetKcal: number | null; // 每日目标摄入（kcal）。null 时按 goal 取默认值
  heightCm: number | null;
  weightKg: number | null;
  age: number | null;
  gender: Gender;
}

/** 个人资料可更新字段（昵称单独经 updateNickname，其余经 updateProfile 持久化到服务端）。 */
export interface ProfilePatch {
  goal?: Goal;
  targetKcal?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  age?: number | null;
  gender?: Gender;
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

/** 单个用户在服务端持久化的全部记录（训练/饮食/身体测量/手动补充）。 */
export interface UserRecords {
  workouts: WorkoutRecord[];
  foods: FoodRecord[];
  measurements: BodyMeasurement[];
  manualBurns: ManualBurn[];
}

/* ------------------------- AI 识别（后端返回） ------------------------- */

export type NutritionQuality = 'reference' | 'official' | 'estimated' | 'pending';
export type MatchTier = 'database' | 'none';

export interface NutritionEstimate {
  source: string;
  sourceLink?: string | null;
  quality?: NutritionQuality | null;
  matchedName?: string | null;
  per100Unit?: 'g' | 'ml' | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface AiEstimate {
  caloriesMin: number | null;
  caloriesMax: number | null;
  caloriesEstimate: number | null; // 范围中点，作为默认记账近似值
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  basis: string | null; // 估算依据与假设
}

export interface RecognizedFood {
  name: string;
  amount: number; // 估算份量克数
  portion?: string; // 份量描述（约一碗/半盘/一个拳头大小）
  ingredients: string[];
  confidence: number; // 0..1
  matchTier?: MatchTier; // database = 命中营养数据库；none = 未命中
  nutrition: NutritionEstimate | null; // 数据库匹配结果
  estimate?: AiEstimate | null; // 数据库未命中时的 AI 估算
}

export interface RecognizeResponse {
  foods: RecognizedFood[];
  uncertainty: string;
}

/** 后端营养数据库中的一条食物记录。 */
export interface FoodEntry {
  name: string;
  aliases: string[];
  category: string;
  brand: string | null;
  style: string | null;
  size: string | null;
  per100: { calories: number; protein: number; carbs: number; fat: number };
  per100Unit: 'g' | 'ml';
  defaultPortion: { amount: number; unit: string };
  source: string;
  sourceLink: string | null;
  updatedAt: string;
  quality: NutritionQuality;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
