import {
  BodyMeasurement,
  FoodRecord,
  ManualBurn,
  WorkoutRecord,
} from './types';
import { addDays, todayISO } from './date';
import { nowISO, uid } from './util';

/**
 * 预置示例数据（用于 Demo 演示，全部标记 isSample: true）。
 * 时间相对「今天」生成，保证首页/趋势始终有可展示内容。
 * 说明：这些是虚构数据，不代表任何真实用户记录。
 */

interface SeedData {
  workouts: WorkoutRecord[];
  foods: FoodRecord[];
  measurements: BodyMeasurement[];
  manualBurns: ManualBurn[];
}

const t = todayISO();

function w(date: string, type: string, durationMin: number, caloriesBurned: number, note: string, mood: WorkoutRecord['mood']): WorkoutRecord {
  return {
    id: uid(),
    date,
    type,
    durationMin,
    caloriesBurned,
    note,
    mood,
    isSample: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function f(
  date: string,
  mealType: FoodRecord['mealType'],
  foodName: string,
  amountG: number,
  calories: number,
  protein: number,
  carbs: number,
  fat: number,
  source: FoodRecord['source'],
): FoodRecord {
  return {
    id: uid(),
    date,
    mealType,
    foodName,
    amountG,
    calories,
    protein,
    carbs,
    fat,
    source,
    isMock: false,
    confidence: source === 'ai' ? 0.7 : null,
    uncertaintyNote: source === 'ai' ? '示例数据：预置的识别示例（演示用，非真实模型结果）' : null,
    nutritionSource: source === 'ai' ? '内置食物营养表（近似值）' : null,
    imageUri: null,
    isSample: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function m(date: string, weightKg: number, waistCm: number, hipCm: number): BodyMeasurement {
  return {
    id: uid(),
    date,
    weightKg,
    waistCm,
    hipCm,
    note: '',
    isSample: true,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

export function buildSeedData(): SeedData {
  return {
    workouts: [
      w(addDays(t, -6), '力量训练', 55, 340, '胸 + 三头，卧推有进步', 'great'),
      w(addDays(t, -5), '跑步', 30, 260, '5 公里慢跑', 'ok'),
      w(addDays(t, -4), '爬坡', 25, 220, '坡度 8% 快走', 'ok'),
      w(addDays(t, -3), '力量训练', 60, 380, '背 + 二头', 'great'),
      w(addDays(t, -2), '跑楼梯', 20, 280, '楼梯 15 组', 'tired'),
      w(addDays(t, -1), '跑步', 35, 300, '间歇跑 4 组', 'tired'),
    ],
    foods: [
      // 今天：早餐 + 午餐（留出晚饭让访客体验「上传识别」）
      f(t, 'breakfast', '燕麦牛奶 + 香蕉', 300, 320, 12, 55, 7, 'manual'),
      f(t, 'lunch', '鸡胸肉沙拉', 350, 420, 45, 18, 18, 'ai'),
      // 昨天
      f(addDays(t, -1), 'breakfast', '全麦面包 + 鸡蛋 ×2', 180, 300, 18, 28, 12, 'manual'),
      f(addDays(t, -1), 'lunch', '牛肉面', 450, 585, 27, 81, 18, 'ai'),
      f(addDays(t, -1), 'dinner', '清蒸鱼 + 西兰花 + 糙米', 420, 480, 38, 52, 12, 'manual'),
      f(addDays(t, -1), 'snack', '酸奶 + 坚果', 150, 210, 9, 15, 13, 'manual'),
      // 前天
      f(addDays(t, -2), 'breakfast', '豆浆 + 杂粮馒头', 250, 300, 14, 45, 7, 'manual'),
      f(addDays(t, -2), 'lunch', '鸡胸肉糙米碗', 400, 520, 40, 62, 12, 'ai'),
      f(addDays(t, -2), 'dinner', '番茄炒蛋 + 米饭', 380, 490, 20, 60, 20, 'manual'),
    ],
    measurements: [
      m(addDays(t, -27), 64.6, 72.0, 95.0),
      m(addDays(t, -20), 64.0, 71.2, 94.5),
      m(addDays(t, -13), 63.4, 70.5, 94.0),
      m(addDays(t, -6), 63.0, 70.0, 93.5),
      m(t, 62.8, 69.5, 93.0),
    ],
    manualBurns: [
      {
        id: uid(),
        date: addDays(t, -1),
        calories: 180,
        note: '午休步行 40 分钟',
        isSample: true,
        createdAt: nowISO(),
      },
    ],
  };
}
