import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 内置食物营养表（每 100g 的 kcal / 蛋白质 / 碳水 / 脂肪，近似值）。
 * 这是演示用的简化数据源；覆盖不足或查不到时，前端会标注「未查到营养数据」并允许用户编辑。
 * 生产环境可替换为更权威、覆盖更全的营养数据库（如 USDA / 国内营养库），并在响应中标注来源。
 */

const table = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'foods.json'), 'utf8'),
);

/** 名称匹配：先精确，再最长子串包含。返回 null 表示未查到。 */
export function lookupFood(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  let best = null;
  for (const f of table) {
    if (f.name === n) return f;
    if (n.includes(f.name) || f.name.includes(n)) {
      if (!best || f.name.length > best.name.length) best = f;
    }
  }
  return best;
}

/**
 * 按确认后的食物名与份量计算营养。
 * 返回 null 表示未查到；否则返回 { source, calories, protein, carbs, fat }。
 */
export function calcNutrition(foodName, amountG) {
  const f = lookupFood(foodName);
  if (!f) return null;
  const k = Math.max(0, Number(amountG) || 0) / 100;
  return {
    source: '内置食物营养表（近似值）',
    calories: Math.round(f.calories * k),
    protein: round1(f.protein * k),
    carbs: round1(f.carbs * k),
    fat: round1(f.fat * k),
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}
