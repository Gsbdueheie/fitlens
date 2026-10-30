import {
  DailySummary,
  FoodRecord,
  Goal,
  ManualBurn,
  WorkoutRecord,
} from './types';
import { round } from './util';

/**
 * 每日目标摄入的默认值（kcal）。
 * 说明：这是面向普通健身人群的粗略基线，用于演示热量预算，
 * 并非个体化营养处方。用户可在「我的」中覆盖为自定义目标。
 */
export const GOAL_DEFAULT_TARGET: Record<Goal, number> = {
  lose: 1800,
  maintain: 2100,
  gain: 2600,
};

export const GOAL_TARGET_NOTE =
  '目标摄入为按健身目标给出的粗略基线（减脂 1800 / 维持 2100 / 增肌 2600 千卡），' +
  '可在「我的」中修改为自定义值，非个体化营养处方。';

export function resolveTarget(goal: Goal, targetKcal: number | null): number {
  return targetKcal ?? GOAL_DEFAULT_TARGET[goal];
}

function sum(items: number[]): number {
  return items.reduce((s, n) => s + n, 0);
}

/**
 * 每日热量与营养汇总。
 * 口径：
 *  - 摄入 = 当日所有饮食记录的 calories 之和；
 *  - 运动消耗 = 当日训练记录 caloriesBurned 之和 + 手动补充消耗之和（避免重复：同一活动只记一处）；
 *  - 剩余 = 目标 + 运动消耗 - 摄入（含运动补偿的热量预算）。
 * 注意：这里的「运动消耗」仅指主动运动消耗，不等于全天总能量消耗（基础代谢未计入）。
 */
export function computeDailySummary(
  date: string,
  foods: FoodRecord[],
  workouts: WorkoutRecord[],
  manualBurns: ManualBurn[],
  target: number,
): DailySummary {
  const dayFoods = foods.filter((f) => f.date === date);
  const workoutBurn = sum(
    workouts
      .filter((w) => w.date === date)
      .map((w) => w.caloriesBurned ?? 0),
  );
  const manualBurn = sum(
    manualBurns.filter((b) => b.date === date).map((b) => b.calories),
  );

  const intake = round(sum(dayFoods.map((f) => f.calories)));
  const burn = round(workoutBurn + manualBurn);
  const remaining = round(target + burn - intake);

  return {
    date,
    intake,
    burn,
    target,
    remaining,
    protein: round(sum(dayFoods.map((f) => f.protein)), 1),
    carbs: round(sum(dayFoods.map((f) => f.carbs)), 1),
    fat: round(sum(dayFoods.map((f) => f.fat)), 1),
  };
}

export interface Per100g {
  calories: number; // kcal / 100g
  protein: number; // g / 100g
  carbs: number; // g / 100g
  fat: number; // g / 100g
}

/** 按份量（克）等比换算每 100g 营养值。 */
export function scalePer100(per100: Per100g, amountG: number): Per100g {
  const f = amountG / 100;
  return {
    calories: round(per100.calories * f),
    protein: round(per100.protein * f, 1),
    carbs: round(per100.carbs * f, 1),
    fat: round(per100.fat * f, 1),
  };
}
